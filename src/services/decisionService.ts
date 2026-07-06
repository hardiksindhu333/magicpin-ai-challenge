import { compose } from '../composer/deterministicComposer.js';
import { ContextStore } from '../storage/contextStore.js';
import { ReplyAction, TickAction, TickResponse } from '../types/index.js';

export class DecisionService {
  constructor(private readonly store: ContextStore) {}

  public async handleTick(now: string, availableTriggers: string[]): Promise<TickResponse> {
    const actions: TickAction[] = [];
    const triggers = availableTriggers
      .map((id) => this.store.get('trigger', id))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));

    for (const trigger of triggers) {
      const merchantId = (trigger.payload as any)?.merchant_id as string | undefined;
      const customerId = (trigger.payload as any)?.customer_id as string | undefined;
      const merchant = merchantId ? this.store.get('merchant', merchantId) : undefined;
      const category = merchant ? this.store.get('category', (merchant.payload as any)?.category_slug || 'dentists') : undefined;
      const customer = customerId ? this.store.get('customer', customerId) : undefined;
      const result = compose(category, merchant, trigger, customer);
      const triggerKind = (trigger.payload as any)?.kind as string | undefined;

      const templateName = triggerKind === 'perf_spike'
        ? 'vera_perf_spike_v1'
        : triggerKind === 'research_digest'
          ? 'vera_research_digest_v1'
          : 'vera_generic_v1';

      actions.push({
        conversation_id: `conv_${trigger.context_id}`,
        merchant_id: merchantId || 'unknown',
        customer_id: customerId || null,
        send_as: result.send_as,
        trigger_id: trigger.context_id,
        template_name: templateName,
        template_params: [result.body],
        body: result.body,
        cta: result.cta,
        suppression_key: result.suppression_key,
        rationale: result.rationale
      });
    }

    return { actions };
  }

  public async handleReply(conversation_id: string, merchant_id: string, customer_id: string | null, from_role: string, message: string): Promise<ReplyAction> {
    const lower = message.toLowerCase();
    if (lower.includes('stop') || lower.includes('not interested') || lower.includes('no thanks')) {
      return { action: 'end', rationale: 'Merchant explicitly opted out.' };
    }

    if (lower.includes('thank you') || lower.includes('auto-reply')) {
      return { action: 'wait', wait_seconds: 14400, rationale: 'Detected an auto-reply pattern and backed off to avoid spam.' };
    }

    return {
      action: 'send',
      body: `Thanks for the reply. I will continue with a concrete follow-up for ${merchant_id}.`,
      cta: 'open_ended',
      rationale: 'Continuing the conversation with a grounded follow-up.'
    };
  }
}
