import test from 'node:test';
import assert from 'node:assert/strict';
import { DecisionService } from '../src/services/decisionService.js';
import { ConversationStore } from '../src/storage/conversationStore.js';
import { ContextStore } from '../src/storage/contextStore.js';

function createService() {
  return new DecisionService(new ContextStore(), new ConversationStore());
}

test('reply flow ends on clear opt-out', async () => {
  const service = createService();
  const result = await service.handleReply('conv_1', 'm_001', null, 'merchant', 'Not interested. Stop messaging me.');
  assert.equal(result.action, 'end');
});

test('reply flow detects first auto-reply and prompts owner', async () => {
  const service = createService();
  const result = await service.handleReply('conv_1', 'm_001', null, 'merchant', 'Thank you for contacting Dr. Meera\'s Dental Clinic! Our team will respond shortly.');
  assert.equal(result.action, 'send');
  assert.match(result.body ?? '', /auto-reply|owner|YES/i);
});

test('reply flow waits on repeated auto-replies', async () => {
  const service = createService();
  const autoReply = 'Thank you for contacting Dr. Meera\'s Dental Clinic! Our team will respond shortly.';
  await service.handleReply('conv_2', 'm_001', null, 'merchant', autoReply);
  const result = await service.handleReply('conv_2', 'm_001', null, 'merchant', autoReply);
  assert.equal(result.action, 'wait');
  assert.equal(result.wait_seconds, 86400);
});

test('reply flow ends after third identical auto-reply', async () => {
  const service = createService();
  const autoReply = 'Thank you for contacting Dr. Meera\'s Dental Clinic! Our team will respond shortly.';
  await service.handleReply('conv_3', 'm_001', null, 'merchant', autoReply);
  await service.handleReply('conv_3', 'm_001', null, 'merchant', autoReply);
  const result = await service.handleReply('conv_3', 'm_001', null, 'merchant', autoReply);
  assert.equal(result.action, 'end');
});

test('reply flow advances when merchant commits', async () => {
  const service = createService();
  const result = await service.handleReply('conv_1', 'm_001', null, 'merchant', "Ok, let's do it. What's next?");
  assert.equal(result.action, 'send');
  assert.equal(result.cta, 'binary_confirm_cancel');
});

test('reply flow advances when merchant wants to join', async () => {
  const service = createService();
  const result = await service.handleReply('conv_1', 'm_001', null, 'merchant', 'I want to join and get started right away.');
  assert.equal(result.action, 'send');
  assert.equal(result.cta, 'binary_confirm_cancel');
});

test('reply flow redirects off-topic GST questions', async () => {
  const service = createService();
  const result = await service.handleReply('conv_1', 'm_001', null, 'merchant', 'Can you also help me file my GST return?');
  assert.equal(result.action, 'send');
  assert.match(result.body ?? '', /GST|tax|accountant|bookkeeper/i);
});

test('reply flow waits when merchant asks for time', async () => {
  const service = createService();
  const result = await service.handleReply('conv_1', 'm_001', null, 'merchant', 'Can we do this later today?');
  assert.equal(result.action, 'wait');
  assert.equal(result.wait_seconds, 1800);
});
