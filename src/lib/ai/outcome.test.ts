import assert from 'node:assert/strict';
import { test } from 'node:test';
import { replyOutcome, statusOutcome } from './outcome.ts';

test('replyOutcome joins text parts and skips thoughts', () => {
  assert.deepEqual(
    replyOutcome({
      candidates: [
        {
          finishReason: 'STOP',
          content: {
            parts: [{ text: 'thinking…', thought: true }, { text: 'First. ' }, { text: 'Second.' }],
          },
        },
      ],
    }),
    { status: 'ok', text: 'First. Second.' }
  );
});

test('replyOutcome keeps a truncated reply but rejects blocked, unsafe and empty ones', () => {
  const truncated = replyOutcome({
    candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'Cut' }] } }],
  });
  assert.deepEqual(truncated, { status: 'ok', text: 'Cut' });
  [
    { promptFeedback: { blockReason: 'SAFETY' } },
    { candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'partial' }] } }] },
    { candidates: [{ finishReason: 'RECITATION' }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [] } }] },
    { candidates: [] },
    {},
  ].forEach((reply) => assert.deepEqual(replyOutcome(reply), { status: 'unavailable' }));
});

test('statusOutcome maps 429 to a retry message and hides other errors', () => {
  assert.equal(statusOutcome(429).status, 'limit');
  assert.deepEqual(statusOutcome(500), { status: 'unavailable' });
  assert.deepEqual(statusOutcome(403), { status: 'unavailable' });
});
