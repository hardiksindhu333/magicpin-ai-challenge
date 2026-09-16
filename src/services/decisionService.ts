import { compose, ComposeResult } from '../composer/deterministicComposer.js';
import { ConversationStore } from '../storage/conversationStore.js';
import { ContextStore } from '../storage/contextStore.js';
import { ReplyAction, TickAction, TickResponse } from '../types/index.js';
import {
  asNumber,
  asString,
  isExpired,
  ownerFirstName,
  payloadOf
} from '../utils/contextHelpers.js';

const MAX_ACTIONS_PER_TICK = 20;

export class DecisionService {
  constructor(
    private readonly store: ContextStore,
    private readonly conversations: ConversationStore
  ) {}

  public async handleTick(now: string, availableTriggers: string[]): Promise<TickResponse> {
    const triggerRecords = availableTriggers
      .map((id) => this.store.get('trigger', id))
      .filter((record): record is NonNullable<typeof record> => Boolean(record))
      .filter((record) => !isExpired(asString(payloadOf(record).expires_at), now))
      .sort((left, right) => (asNumber(payloadOf(right).urgency) ?? 0) - (asNumber(payloadOf(left).urgency) ?? 0));

    const actions: TickAction[] = [];
    const merchantsUsedThisTick = new Set<string>();

    for (const trigger of triggerRecords) {
      if (actions.length >= MAX_ACTIONS_PER_TICK) {
        break;
      }

      const triggerPayload = payloadOf(trigger);
      const suppressionKey = asString(triggerPayload.suppression_key);
      const merchantId = asString(triggerPayload.merchant_id);
      const customerId = asString(triggerPayload.customer_id) ?? null;

      if (!merchantId || !suppressionKey) {
        continue;
      }

      if (this.conversations.isSuppressed(suppressionKey) || this.conversations.isMerchantSuppressed(merchantId)) {
        continue;
      }

      if (merchantsUsedThisTick.has(merchantId)) {
        continue;
      }

      const merchant = this.store.get('merchant', merchantId);
      if (!merchant) {
        continue;
      }

      const merchantPayload = payloadOf(merchant);
      const categorySlug = asString(merchantPayload.category_slug);
      const category = categorySlug ? this.store.get('category', categorySlug) : undefined;
      const customer = customerId ? this.store.get('customer', customerId) : undefined;
      const composed = compose(category, merchant, trigger, customer, now);
      const conversationId = this.buildConversationId(trigger.context_id, merchantId, customerId);
      const action = this.toTickAction(composed, trigger.context_id, merchantId, customerId, conversationId);

      this.conversations.recordOutbound(
        conversationId,
        merchantId,
        customerId,
        trigger.context_id,
        action.body,
        suppressionKey
      );

      merchantsUsedThisTick.add(merchantId);
      actions.push(action);
    }

    return { actions };
  }

  public async handleReply(
    conversationId: string,
    merchantId: string,
    customerId: string | null,
    fromRole: string,
    message: string
  ): Promise<ReplyAction> {
    if (this.conversations.isConversationEnded(conversationId)) {
      return { action: 'end', rationale: 'Conversation already closed; no further messages will be sent.' };
    }

    const state = this.conversations.recordInbound(conversationId, fromRole, message);
    const merchant = this.store.get('merchant', merchantId);
    const merchantPayload = payloadOf(merchant);
    const merchantName = ownerFirstName(merchantPayload) ?? merchantId;
    const lower = message.toLowerCase().trim();

    if (this.isOptOut(lower)) {
      this.conversations.endConversation(conversationId, merchantId);
      return { action: 'end', rationale: 'Merchant explicitly opted out. Closing conversation gracefully.' };
    }

    if (fromRole === 'merchant' && state.auto_reply_count >= 3) {
      this.conversations.endConversation(conversationId, merchantId);
      return {
        action: 'end',
        rationale: 'Same auto-reply repeated 3 times with no real engagement; closing to avoid wasted turns.'
      };
    }

    if (fromRole === 'merchant' && state.auto_reply_count >= 2) {
      return {
        action: 'wait',
        wait_seconds: 86400,
        rationale: 'Same auto-reply twice in a row; owner likely not at phone. Waiting 24h before retry.'
      };
    }

    if (fromRole === 'merchant' && state.auto_reply_count === 1) {
      const body = `Looks like an auto-reply. When the owner sees this, just reply YES and I will continue with the next step for ${merchantName}.`;
      if (!this.conversations.hasRepeatedBody(conversationId, body)) {
        this.conversations.recordReplyBody(conversationId, body);
        return {
          action: 'send',
          body,
          cta: 'binary_yes_no',
          rationale: 'Detected canned auto-reply; one explicit prompt to flag it for the owner.'
        };
      }
    }

    if (lower.includes('later') || lower.includes('not now') || lower.includes('tomorrow') || lower.includes('give me some time') || lower.includes('can we do this later')) {
      return { action: 'wait', wait_seconds: 1800, rationale: 'Merchant asked for time; backing off briefly instead of pushing.' };
    }

    if (this.isCommitment(lower)) {
      const body = `Great, ${merchantName}. Drafting the next step now — I will send a concrete patient-ed draft and pre-fill the GBP post for tomorrow 10am. Reply CONFIRM to proceed.`;
      if (!this.conversations.hasRepeatedBody(conversationId, body)) {
        this.conversations.recordReplyBody(conversationId, body);
        return {
          action: 'send',
          body,
          cta: 'binary_confirm_cancel',
          rationale: 'Merchant explicitly committed; switching from qualification to action execution.'
        };
      }
    }

    if (lower.includes('gst') || lower.includes('tax filing') || lower.includes('file my gst')) {
      const body = `GST filing is outside what I can handle directly — better to loop in your CA. Coming back to your listing: want me to draft the patient post first, or send the abstract?`;
      if (!this.conversations.hasRepeatedBody(conversationId, body)) {
        this.conversations.recordReplyBody(conversationId, body);
        return {
          action: 'send',
          body,
          cta: 'open_ended',
          rationale: 'Off-topic request declined politely; redirected to the original trigger thread.'
        };
      }
    }

    if (lower.includes('yes') || lower.includes('send') || lower.includes('please') || lower.includes('abstract') || lower.includes('draft')) {
      const body = `Sending now — also drafted a 90-sec patient-ed WhatsApp you can copy-paste for ${merchantName}'s high-risk adult patients. Want me to schedule the Google post for tomorrow 10am?`;
      if (!this.conversations.hasRepeatedBody(conversationId, body)) {
        this.conversations.recordReplyBody(conversationId, body);
        return {
          action: 'send',
          body,
          cta: 'binary_yes_no',
          rationale: 'Honoring merchant acceptance and advancing with the next concrete step.'
        };
      }
    }

    const fallback = `Thanks for the reply, ${merchantName}. I will keep this focused on the current trigger and your account data. What would you like me to draft next?`;
    if (this.conversations.hasRepeatedBody(conversationId, fallback)) {
      return { action: 'end', rationale: 'Avoiding repeated message bodies in the same conversation.' };
    }

    this.conversations.recordReplyBody(conversationId, fallback);
    return {
      action: 'send',
      body: fallback,
      cta: 'open_ended',
      rationale: 'Continuing the conversation with a grounded follow-up.'
    };
  }

  private toTickAction(
    composed: ComposeResult,
    triggerId: string,
    merchantId: string,
    customerId: string | null,
    conversationId: string
  ): TickAction {
    return {
      conversation_id: conversationId,
      merchant_id: merchantId,
      customer_id: customerId,
      send_as: composed.send_as,
      trigger_id: triggerId,
      template_name: composed.template_name,
      template_params: composed.template_params,
      body: composed.body,
      cta: composed.cta,
      suppression_key: composed.suppression_key,
      rationale: composed.rationale
    };
  }

  private buildConversationId(triggerId: string, merchantId: string, customerId: string | null): string {
    if (customerId) {
      return `conv_${customerId}_${triggerId}`;
    }

    return `conv_${merchantId}_${triggerId}`;
  }

  private isOptOut(message: string): boolean {
    return (
      message.includes('stop messaging') ||
      message.includes('not interested') ||
      message.includes('no thanks') ||
      message.includes('unsubscribe') ||
      message.includes('useless spam') ||
      message.includes('stop sending')
    );
  }

  private isCommitment(message: string): boolean {
    return (
      message.includes("let's do it") ||
      message.includes('lets do it') ||
      message.includes('yes please') ||
      message.includes("ok let's") ||
      message.includes('confirm') ||
      message.includes('i want to join') ||
      message.includes('get started') ||
      message.includes("what's next")
    );
  }
}
