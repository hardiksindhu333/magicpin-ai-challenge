export interface ConversationTurn {
  from_role: string;
  message: string;
  body_sent?: string;
}

export interface ConversationState {
  merchant_id: string;
  customer_id: string | null;
  trigger_id?: string;
  turns: ConversationTurn[];
  last_auto_reply_message?: string;
  auto_reply_count: number;
  ended: boolean;
  sent_bodies: string[];
}

const AUTO_REPLY_PATTERNS = [
  'thank you for contacting',
  'team will respond shortly',
  'our team will get back',
  'we will respond shortly',
  'automated assistant',
  'auto-reply'
];

export class ConversationStore {
  private readonly conversations = new Map<string, ConversationState>();
  private readonly suppressedKeys = new Set<string>();
  private readonly suppressedMerchants = new Set<string>();

  public recordOutbound(
    conversationId: string,
    merchantId: string,
    customerId: string | null,
    triggerId: string,
    body: string,
    suppressionKey: string
  ): void {
    const state = this.ensureConversation(conversationId, merchantId, customerId);
    state.trigger_id = triggerId;
    state.sent_bodies.push(body);
    this.suppressedKeys.add(suppressionKey);
  }

  public recordInbound(conversationId: string, fromRole: string, message: string): ConversationState {
    const state = this.conversations.get(conversationId) ?? {
      merchant_id: 'unknown',
      customer_id: null,
      turns: [],
      auto_reply_count: 0,
      ended: false,
      sent_bodies: []
    };

    state.turns.push({ from_role: fromRole, message });
    this.conversations.set(conversationId, state);

    if (fromRole === 'merchant' && this.isAutoReply(message)) {
      const normalized = message.trim().toLowerCase();
      if (state.last_auto_reply_message === normalized) {
        state.auto_reply_count += 1;
      } else {
        state.last_auto_reply_message = normalized;
        state.auto_reply_count = 1;
      }
    }

    return state;
  }

  public isSuppressed(suppressionKey: string): boolean {
    return this.suppressedKeys.has(suppressionKey);
  }

  public isMerchantSuppressed(merchantId: string): boolean {
    return this.suppressedMerchants.has(merchantId);
  }

  public isConversationEnded(conversationId: string): boolean {
    return this.conversations.get(conversationId)?.ended === true;
  }

  public endConversation(conversationId: string, merchantId?: string): void {
    const state = this.conversations.get(conversationId);
    if (state) {
      state.ended = true;
    }

    if (merchantId) {
      this.suppressedMerchants.add(merchantId);
    }
  }

  public hasRepeatedBody(conversationId: string, body: string): boolean {
    const state = this.conversations.get(conversationId);
    if (!state) {
      return false;
    }

    return state.sent_bodies.includes(body);
  }

  public getConversation(conversationId: string): ConversationState | undefined {
    return this.conversations.get(conversationId);
  }

  public recordReplyBody(conversationId: string, body: string): void {
    const state = this.conversations.get(conversationId);
    if (!state) {
      return;
    }

    state.sent_bodies.push(body);
    const lastTurn = state.turns[state.turns.length - 1];
    if (lastTurn) {
      lastTurn.body_sent = body;
    }
  }

  private ensureConversation(
    conversationId: string,
    merchantId: string,
    customerId: string | null
  ): ConversationState {
    const existing = this.conversations.get(conversationId);
    if (existing) {
      return existing;
    }

    const created: ConversationState = {
      merchant_id: merchantId,
      customer_id: customerId,
      turns: [],
      auto_reply_count: 0,
      ended: false,
      sent_bodies: []
    };
    this.conversations.set(conversationId, created);
    return created;
  }

  private isAutoReply(message: string): boolean {
    const lower = message.toLowerCase();
    return AUTO_REPLY_PATTERNS.some((pattern) => lower.includes(pattern));
  }
}
