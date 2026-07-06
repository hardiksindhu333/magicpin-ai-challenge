import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/composer/deterministicComposer.js';
test('customer trigger composes a customer-facing recall message', () => {
    const result = compose({ scope: 'category', context_id: 'dentists', version: 1, payload: { slug: 'dentists' }, delivered_at: '2026-04-26T00:00:00Z' }, { scope: 'merchant', context_id: 'm_001', version: 1, payload: { merchant_id: 'm_001', identity: { name: 'Dr. Meera\'s Dental Clinic' } }, delivered_at: '2026-04-26T00:00:00Z' }, { scope: 'trigger', context_id: 'trg_001', version: 1, payload: { kind: 'recall_due', suppression_key: 'recall:customer:1', merchant_id: 'm_001', customer_id: 'c_001' }, delivered_at: '2026-04-26T00:00:00Z' }, { scope: 'customer', context_id: 'c_001', version: 1, payload: { identity: { name: 'Priya' } }, delivered_at: '2026-04-26T00:00:00Z' });
    assert.equal(result.send_as, 'merchant_on_behalf');
    assert.equal(result.cta, 'binary_yes_no');
    assert.match(result.body, /Priya/);
});
