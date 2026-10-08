export type AiOutcome =
  { status: 'ok'; text: string } | { status: 'limit'; message: string } | { status: 'unavailable' };

export const DAILY_CAP = { guest: 5, account: 50 } as const;

export const LIMIT_REACHED: AiOutcome = {
  status: 'limit',
  message: 'You’ve used today’s AI summaries. They reset at midnight UTC.',
};

export const BUSY: AiOutcome = {
  status: 'limit',
  message: 'The AI is busy. Try again in a minute.',
};

export interface GeminiReply {
  promptFeedback?: { blockReason?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
}

const USABLE_FINISH = new Set(['STOP', 'MAX_TOKENS']);

export function replyOutcome(reply: GeminiReply): AiOutcome {
  if (reply.promptFeedback?.blockReason) return { status: 'unavailable' };
  const [candidate] = reply.candidates ?? [];
  if (!candidate || !USABLE_FINISH.has(candidate.finishReason ?? '')) {
    return { status: 'unavailable' };
  }
  const text = (candidate.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('')
    .trim();
  return text ? { status: 'ok', text } : { status: 'unavailable' };
}

export const statusOutcome = (status: number): AiOutcome =>
  status === 429 ? BUSY : { status: 'unavailable' };
