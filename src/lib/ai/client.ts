import 'server-only';
import prisma from '@/lib/db';
import env from '@/lib/env';
import {
  type AiOutcome,
  DAILY_CAP,
  type GeminiReply,
  LIMIT_REACHED,
  replyOutcome,
  statusOutcome,
} from '@/lib/ai/outcome';

const MODEL = 'gemini-3.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 30_000;

export const aiEnabled = Boolean(env.GEMINI_API_KEY);

async function takeQuota(userId: string, isGuest: boolean) {
  const cap = isGuest ? DAILY_CAP.guest : DAILY_CAP.account;
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "AiUsage" ("userId", day, count) VALUES (${userId}, CURRENT_DATE, 1)
    ON CONFLICT ("userId", day) DO UPDATE SET count = "AiUsage".count + 1
    WHERE "AiUsage".count < ${cap}
    RETURNING count`;
  return rows.length > 0;
}

export async function generate(
  user: { id: string; isAnonymous?: boolean | null },
  system: string,
  input: string
): Promise<AiOutcome> {
  if (!env.GEMINI_API_KEY) return { status: 'unavailable' };
  if (!(await takeQuota(user.id, Boolean(user.isAnonymous)))) return LIMIT_REACHED;
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: input }] }],
        generationConfig: { maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[ai] Gemini ${response.status}: ${(await response.text()).slice(0, 500)}`);
      return statusOutcome(response.status);
    }
    return replyOutcome((await response.json()) as GeminiReply);
  } catch (error) {
    console.error('[ai] Gemini request failed', error);
    return { status: 'unavailable' };
  }
}
