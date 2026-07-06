import { ContextRecord, ContextStoreState, Scope } from '../types/index.js';

export class ContextStore {
  private state: ContextStoreState = {
    categories: {},
    merchants: {},
    customers: {},
    triggers: {}
  };

  public upsert(scope: Scope, context_id: string, version: number, payload: unknown, delivered_at: string): { accepted: true; record: ContextRecord } | { accepted: false; reason: 'stale_version'; current_version: number } {
    const bucket = this.getBucket(scope);
    const existing = bucket[context_id];

    if (existing && existing.version > version) {
      return { accepted: false, reason: 'stale_version', current_version: existing.version };
    }

    if (existing && existing.version === version) {
      return { accepted: false, reason: 'stale_version', current_version: existing.version };
    }

    const record: ContextRecord = { scope, context_id, version, payload, delivered_at };
    bucket[context_id] = record;
    return { accepted: true, record };
  }

  public getCounts() {
    return {
      category: Object.keys(this.state.categories).length,
      merchant: Object.keys(this.state.merchants).length,
      customer: Object.keys(this.state.customers).length,
      trigger: Object.keys(this.state.triggers).length
    };
  }

  public get(scope: Scope, context_id: string): ContextRecord | undefined {
    return this.getBucket(scope)[context_id];
  }

  public list(scope: Scope): ContextRecord[] {
    return Object.values(this.getBucket(scope));
  }

  private getBucket(scope: Scope): Record<string, ContextRecord> {
    switch (scope) {
      case 'category': return this.state.categories;
      case 'merchant': return this.state.merchants;
      case 'customer': return this.state.customers;
      case 'trigger': return this.state.triggers;
    }
  }
}
