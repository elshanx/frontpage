import { APIError, RateLimitError } from '@anthropic-ai/sdk';

export type AiOutcome =
  { status: 'ok'; text: string } | { status: 'limit'; message: string } | { status: 'unavailable' };

export const DAILY_CAP = { guest: 5, account: 50 } as const;

export const LIMIT_REACHED: AiOutcome = {
  status: 'limit',
  message: 'You’ve used today’s AI summaries. They reset at midnight UTC.',
};

interface ModelReply {
  stop_reason: string | null;
  content: { type: string; text?: string }[];
}

export function replyOutcome(reply: ModelReply): AiOutcome {
  if (reply.stop_reason === 'refusal') return { status: 'unavailable' };
  const text = reply.content
    .map((block) => (block.type === 'text' ? (block.text ?? '') : ''))
    .join('')
    .trim();
  return text ? { status: 'ok', text } : { status: 'unavailable' };
}

export function errorOutcome(error: unknown): AiOutcome {
  if (error instanceof RateLimitError) {
    return { status: 'limit', message: 'The AI is busy. Try again in a minute.' };
  }
  if (error instanceof APIError) return { status: 'unavailable' };
  throw error;
}
