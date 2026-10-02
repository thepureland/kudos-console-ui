import assert from 'node:assert/strict';
import test from 'node:test';
import { createI18n } from 'vue-i18n';
import { flatMessagesToNested, isSafeMessagePath } from '../src/i18n/safeMessages.ts';

test('backend keys cannot modify the prototype of unrelated objects', () => {
  const messages = flatMessagesToNested({
    '__proto__.__kudosReviewMarker': 'unsafe',
    'nested.__proto__.__kudosReviewMarker': 'unsafe',
    'constructor.prototype.__kudosReviewMarker': 'unsafe',
    'columns.name': 'Name',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(Object.prototype, '__kudosReviewMarker'), false);
  assert.equal(({}).__kudosReviewMarker, undefined);
  assert.equal(messages.columns.name, 'Name');
  assert.equal(Object.getPrototypeOf(messages), null);
  assert.equal(Object.getPrototypeOf(messages.columns), null);
});

test('reserved names and empty segments are rejected at every level', () => {
  for (const path of ['__proto__', 'constructor', 'prototype', 'a.constructor.b', 'a.prototype', 'a..b', '']) {
    assert.equal(isSafeMessagePath(path), false, path);
  }
  assert.equal(isSafeMessagePath('columns.name'), true);
});

test('valid null-prototype messages still merge and render in vue-i18n', () => {
  const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': {} } });
  i18n.global.mergeLocaleMessage('en-US', flatMessagesToNested({ 'columns.name': 'Name', 'errors.required': 'Required' }));
  assert.equal(i18n.global.t('columns.name'), 'Name');
  assert.equal(i18n.global.t('errors.required'), 'Required');
});
