import { compose } from '../composer/deterministicComposer.js';
export class DecisionService {
    store;
    constructor(store) {
        this.store = store;
    }
    async handleTick(now, availableTriggers) {
        const actions = [];
        const triggers = availableTriggers
            .map((id) => this.store.get('trigger', id))
            .filter((value) => Boolean(value));
        for (const trigger of triggers) {
            const merchantId = trigger.payload?.merchant_id;
            const customerId = trigger.payload?.customer_id;
            const merchant = merchantId ? this.store.get('merchant', merchantId) : undefined;
            const category = merchant ? this.store.get('category', merchant.payload?.category_slug || 'dentists') : undefined;
            const customer = customerId ? this.store.get('customer', customerId) : undefined;
            const result = compose(category, merchant, trigger, customer);
            const triggerKind = trigger.payload?.kind;
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
    async handleReply(conversation_id, merchant_id, customer_id, from_role, message) {
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
