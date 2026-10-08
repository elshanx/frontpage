import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fieldErrors, resetSchema, safeNextPath, signInSchema, signUpSchema } from './forms.ts';

test('signUpSchema normalizes email and enforces password length', () => {
  const ok = signUpSchema.parse({
    name: ' Ana ',
    email: ' Ana@Example.COM ',
    password: 'longenough',
  });
  assert.deepEqual(ok, { name: 'Ana', email: 'ana@example.com', password: 'longenough' });
  const bad = signUpSchema.safeParse({ name: '', email: 'nope', password: 'short' });
  assert.equal(bad.success, false);
  if (!bad.success) {
    assert.deepEqual(Object.keys(fieldErrors(bad.error)).sort(), ['email', 'name', 'password']);
  }
});

test('signInSchema only requires a non-empty password', () => {
  assert.equal(signInSchema.safeParse({ email: 'a@b.co', password: 'x' }).success, true);
  assert.equal(signInSchema.safeParse({ email: 'a@b.co', password: '' }).success, false);
});

test('resetSchema requires matching passwords and reports on confirm', () => {
  const bad = resetSchema.safeParse({ password: 'longenough', confirm: 'different1' });
  assert.equal(bad.success, false);
  if (!bad.success) assert.ok(fieldErrors(bad.error).confirm);
});

test('safeNextPath only allows same-origin paths', () => {
  assert.equal(safeNextPath('/app?feed=1'), '/app?feed=1');
  [
    '//evil.com',
    'https://evil.com',
    '/\\evil.com',
    '/\t/evil.com',
    '/\n/evil.com',
    '/\t\\evil.com',
    'javascript:alert(1)',
    '',
    null,
    undefined,
    'app',
  ].forEach((value) => assert.equal(safeNextPath(value), '/app', String(value)));
});
