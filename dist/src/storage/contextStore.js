export class ContextStore {
    state = {
        categories: {},
        merchants: {},
        customers: {},
        triggers: {}
    };
    upsert(scope, context_id, version, payload, delivered_at) {
        const bucket = this.getBucket(scope);
        const existing = bucket[context_id];
        if (existing && existing.version > version) {
            return { accepted: false, reason: 'stale_version', current_version: existing.version };
        }
        if (existing && existing.version === version) {
            return { accepted: false, reason: 'stale_version', current_version: existing.version };
        }
        const record = { scope, context_id, version, payload, delivered_at };
        bucket[context_id] = record;
        return { accepted: true, record };
    }
    getCounts() {
        return {
            category: Object.keys(this.state.categories).length,
            merchant: Object.keys(this.state.merchants).length,
            customer: Object.keys(this.state.customers).length,
            trigger: Object.keys(this.state.triggers).length
        };
    }
    get(scope, context_id) {
        return this.getBucket(scope)[context_id];
    }
    list(scope) {
        return Object.values(this.getBucket(scope));
    }
    getBucket(scope) {
        switch (scope) {
            case 'category': return this.state.categories;
            case 'merchant': return this.state.merchants;
            case 'customer': return this.state.customers;
            case 'trigger': return this.state.triggers;
        }
    }
}
