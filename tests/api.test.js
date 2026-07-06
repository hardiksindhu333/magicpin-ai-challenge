import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
test('health endpoint returns ok status', async () => {
    const app = createApp();
    const response = await request(app).get('/v1/healthz');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
        status: 'ok',
        uptime_seconds: response.body.uptime_seconds,
        contexts_loaded: { category: 0, merchant: 0, customer: 0, trigger: 0 }
    });
});
test('context endpoint stores and rejects stale versions', async () => {
    const app = createApp();
    const first = await request(app).post('/v1/context').send({
        scope: 'merchant',
        context_id: 'm_001',
        version: 1,
        delivered_at: '2026-04-26T09:45:00Z',
        payload: { merchant_id: 'm_001' }
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.accepted, true);
    const second = await request(app).post('/v1/context').send({
        scope: 'merchant',
        context_id: 'm_001',
        version: 1,
        delivered_at: '2026-04-26T09:45:30Z',
        payload: { merchant_id: 'm_001' }
    });
    assert.equal(second.status, 200);
    assert.equal(second.body.accepted, false);
    assert.equal(second.body.reason, 'stale_version');
});
