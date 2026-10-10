import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { createApp } from '../src/app.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'challenge', 'dataset');

function loadJson(relativePath: string) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

test('integration: dataset research digest tick uses digest item from category', async () => {
  const app = createApp();
  const dentists = loadJson('categories/dentists.json');
  const merchants = loadJson('merchants_seed.json');
  const triggers = loadJson('triggers_seed.json');
  const meera = merchants.merchants.find((merchant: { merchant_id: string }) => merchant.merchant_id === 'm_001_drmeera_dentist_delhi');
  const trigger = triggers.triggers.find((item: { id: string }) => item.id === 'trg_001_research_digest_dentists');

  await request(app).post('/v1/context').send({
    scope: 'category',
    context_id: 'dentists',
    version: 1,
    payload: dentists
  });

  await request(app).post('/v1/context').send({
    scope: 'merchant',
    context_id: meera.merchant_id,
    version: 1,
    payload: meera
  });

  await request(app).post('/v1/context').send({
    scope: 'trigger',
    context_id: trigger.id,
    version: 1,
    payload: trigger
  });

  const firstTick = await request(app).post('/v1/tick').send({
    now: '2026-04-26T10:35:00Z',
    available_triggers: [trigger.id]
  });

  assert.equal(firstTick.status, 200);
  assert.equal(firstTick.body.actions.length, 1);
  assert.match(firstTick.body.actions[0].body, /JIDA|fluoride|2,100|high-risk/i);
  assert.match(firstTick.body.actions[0].body, /JIDA Oct 2026, p\.14/);

  const secondTick = await request(app).post('/v1/tick').send({
    now: '2026-04-26T10:40:00Z',
    available_triggers: [trigger.id]
  });

  assert.equal(secondTick.body.actions.length, 0);
});

test('integration: recall due composes customer-facing slot message', async () => {
  const app = createApp();
  const dentists = loadJson('categories/dentists.json');
  const merchants = loadJson('merchants_seed.json');
  const customers = loadJson('customers_seed.json');
  const triggers = loadJson('triggers_seed.json');
  const meera = merchants.merchants.find((merchant: { merchant_id: string }) => merchant.merchant_id === 'm_001_drmeera_dentist_delhi');
  const priya = customers.customers.find((customer: { customer_id: string }) => customer.customer_id === 'c_001_priya_for_m001');
  const trigger = triggers.triggers.find((item: { id: string }) => item.id === 'trg_003_recall_due_priya');

  await request(app).post('/v1/context').send({ scope: 'category', context_id: 'dentists', version: 1, payload: dentists });
  await request(app).post('/v1/context').send({ scope: 'merchant', context_id: meera.merchant_id, version: 1, payload: meera });
  await request(app).post('/v1/context').send({ scope: 'customer', context_id: priya.customer_id, version: 1, payload: priya });
  await request(app).post('/v1/context').send({ scope: 'trigger', context_id: trigger.id, version: 1, payload: trigger });

  const response = await request(app).post('/v1/tick').send({
    now: '2026-11-01T10:00:00Z',
    available_triggers: [trigger.id]
  });

  assert.equal(response.body.actions.length, 1);
  const action = response.body.actions[0];
  assert.equal(action.send_as, 'merchant_on_behalf');
  assert.equal(action.customer_id, priya.customer_id);
  assert.match(action.body, /Priya/);
  assert.match(action.body, /₹299/);
  assert.match(action.body, /Wed 5 Nov, 6pm|Thu 6 Nov, 5pm/);
});
