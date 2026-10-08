import assert from 'node:assert/strict';
import { test } from 'node:test';
import isCronAuthorized from './cron.ts';

test('isCronAuthorized requires the exact bearer secret', () => {
  assert.equal(isCronAuthorized('Bearer s3cret-value', 's3cret-value'), true);
  assert.equal(isCronAuthorized('Bearer wrong', 's3cret-value'), false);
  assert.equal(isCronAuthorized(null, 's3cret-value'), false);
  assert.equal(isCronAuthorized('Bearer ', ''), false);
  assert.equal(isCronAuthorized('Bearer anything', undefined), false);
});
