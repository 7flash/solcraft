import test from 'node:test';
import assert from 'node:assert/strict';
import { noticeAmount, noticeRemainder, noticeClassName } from './notificationRailModel.ts';

test('noticeAmount extracts resource gain prefix', () => {
  assert.equal(noticeAmount('Picked up +12 wood 🪵.'), '+12 wood');
});

test('noticeRemainder keeps player-facing message', () => {
  assert.equal(noticeRemainder('Picked up +12 wood 🪵.', '+12 wood'), 'Picked up  🪵.');
});

test('noticeClassName marks gone state', () => {
  assert.equal(noticeClassName({ id: 1, text: 'x', kind: 'warn', gone: true }), 'notice-item warn gone');
});
