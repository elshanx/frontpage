import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/db';
import env from '@/lib/env';
import {
  type AiOutcome,
  DAILY_CAP,
  LIMIT_REACHED,
  errorOutcome,
  replyOutcome,
} from '@/lib/ai/outcome';

export const aiEnabled = Boolean(env.ANTHROPIC_API_KEY);

const client = aiEnabled ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

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
  if (!client) return { status: 'unavailable' };
  if (!(await takeQuota(user.id, Boolean(user.isAnonymous)))) return LIMIT_REACHED;
  try {
    const reply = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: input }],
      output_config: { effort: 'low' },
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
    });
    return replyOutcome(reply);
  } catch (error) {
    return errorOutcome(error);
  }
}
