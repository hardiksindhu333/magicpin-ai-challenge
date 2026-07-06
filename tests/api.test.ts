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

test('tick endpoint uses trigger-specific wording for research digests', async () => {
  const app = createApp();

  await request(app).post('/v1/context').send({
    scope: 'category',
    context_id: 'dentists',
    version: 1,
    payload: { slug: 'dentists' }
  });

  await request(app).post('/v1/context').send({
    scope: 'merchant',
    context_id: 'm_001',
    version: 1,
    payload: { merchant_id: 'm_001', category_slug: 'dentists', identity: { name: "Dr. Meera's Dental Clinic" } }
  });

  await request(app).post('/v1/context').send({
    scope: 'trigger',
    context_id: 'trg_research',
    version: 1,
    payload: {
      id: 'trg_research',
      scope: 'merchant',
      kind: 'research_digest',
      source: 'external',
      merchant_id: 'm_001',
      customer_id: null,
      suppression_key: 'research:dentists:2026-W17',
      top_item: {
        title: '3-month fluoride recall cuts caries recurrence 38% better than 6-month',
        source: 'JIDA Oct 2026, p.14',
        trial_n: 2100,
        patient_segment: 'high_risk_adults'
      }
    }
  });

  const response = await request(app).post('/v1/tick').send({
    now: '2026-04-26T10:35:00Z',
    available_triggers: ['trg_research']
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.actions.length, 1);
  const action = response.body.actions[0];
  assert.match(action.body, /JIDA|research/i);
  assert.match(action.body, /2,100|2,100-patient|high-risk/i);
  assert.match(action.body, /2-min|abstract|patient-ed|share/i);
  assert.equal(action.send_as, 'vera');
  assert.equal(action.template_name, 'vera_research_digest_v1');
  assert.ok(action.template_params.some((param: string) => param.includes("Dr. Meera")));
  assert.ok(action.template_params.some((param: string) => param.includes('dentists')));
});

test('tick endpoint uses a performance-specific template for perf spikes', async () => {
  const app = createApp();

  await request(app).post('/v1/context').send({
    scope: 'category',
    context_id: 'dentists',
    version: 1,
    payload: { slug: 'dentists' }
  });

  await request(app).post('/v1/context').send({
    scope: 'merchant',
    context_id: 'm_002',
    version: 1,
    payload: { merchant_id: 'm_002', category_slug: 'dentists', identity: { name: 'Bright Smile Dental' } }
  });

  await request(app).post('/v1/context').send({
    scope: 'trigger',
    context_id: 'trg_perf',
    version: 1,
    payload: {
      id: 'trg_perf',
      scope: 'merchant',
      kind: 'perf_spike',
      source: 'internal',
      merchant_id: 'm_002',
      customer_id: null,
      suppression_key: 'perf:spike:m_002'
    }
  });

  const response = await request(app).post('/v1/tick').send({
    now: '2026-04-26T11:00:00Z',
    available_triggers: ['trg_perf']
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.actions.length, 1);
  assert.match(response.body.actions[0].body, /performance|views|traffic/i);
  assert.equal(response.body.actions[0].template_name, 'vera_perf_spike_v1');
  assert.equal(response.body.actions[0].cta, 'open_ended');
});
