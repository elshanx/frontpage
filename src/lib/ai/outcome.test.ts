import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APIError, RateLimitError } from '@anthropic-ai/sdk';
import { errorOutcome, replyOutcome } from './outcome.ts';

test('replyOutcome joins text blocks and treats refusals and empty replies as unavailable', () => {
  assert.deepEqual(
    replyOutcome({
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking' },
        { type: 'text', text: 'First. ' },
        { type: 'text', text: 'Second.' },
      ],
    }),
    { status: 'ok', text: 'First. Second.' }
  );
  assert.deepEqual(
    replyOutcome({ stop_reason: 'refusal', content: [{ type: 'text', text: 'partial' }] }),
    { status: 'unavailable' }
  );
  assert.deepEqual(replyOutcome({ stop_reason: 'end_turn', content: [] }), {
    status: 'unavailable',
  });
});

test('errorOutcome maps rate limits to a retry message, hides other API errors, rethrows bugs', () => {
  const headers = new Headers();
  assert.equal(
    errorOutcome(new RateLimitError(429, undefined, 'slow down', headers)).status,
    'limit'
  );
  assert.deepEqual(errorOutcome(new APIError(500, undefined, 'boom', headers)), {
    status: 'unavailable',
  });
  assert.throws(() => errorOutcome(new TypeError('bug')), TypeError);
});
