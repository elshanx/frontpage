import 'server-only';
import prisma from '@/lib/db';

export async function findBriefing(userId: string, windowKey: string) {
  const row = await prisma.digestBriefing.findUnique({
    where: { userId_windowKey: { userId, windowKey } },
  });
  return row?.text ?? null;
}

export async function saveBriefing(userId: string, windowKey: string, text: string) {
  await prisma.digestBriefing.upsert({
    where: { userId_windowKey: { userId, windowKey } },
    create: { userId, windowKey, text },
    update: { text },
  });
}
