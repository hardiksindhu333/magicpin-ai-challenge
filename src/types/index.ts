export type Scope = 'category' | 'merchant' | 'customer' | 'trigger';

export interface ContextRecord {
  scope: Scope;
  context_id: string;
  version: number;
  payload: unknown;
  delivered_at: string;
}

export interface ContextStoreState {
  categories: Record<string, ContextRecord>;
  merchants: Record<string, ContextRecord>;
  customers: Record<string, ContextRecord>;
  triggers: Record<string, ContextRecord>;
}

export interface TickAction {
  conversation_id: string;
  merchant_id: string;
  customer_id: string | null;
  send_as: 'vera' | 'merchant_on_behalf';
  trigger_id: string;
  template_name: string;
  template_params: string[];
  body: string;
  cta: string;
  suppression_key: string;
  rationale: string;
}

export interface TickResponse {
  actions: TickAction[];
}

export interface ReplyAction {
  action: 'send' | 'wait' | 'end';
  body?: string;
  cta?: string;
  wait_seconds?: number;
  rationale: string;
}
