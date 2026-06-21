import test from 'node:test';
import assert from 'node:assert/strict';
import { chatLineClassName, chatLineKey } from './gameChatModel.ts';

test('chatLineClassName marks system lines', () => {
  assert.equal(chatLineClassName({ sys: true, m: 'hello' }), 'chat-line sys');
});

test('chatLineClassName marks card lines', () => {
  assert.match(chatLineClassName({ n: 'A', m: '[[sc:location|x=1|z=2|label=Here]]' }), /has-link-card/);
});

test('chatLineKey prefers server id', () => {
  assert.equal(chatLineKey({ id: 42, m: 'x' }, 0), '42');
});
