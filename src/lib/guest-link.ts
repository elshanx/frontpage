import 'server-only';
import planCategoryMerge from '@/lib/accounts/merge';
import prisma from '@/lib/db';

const categoryFields = { id: true, name: true, position: true } as const;

// ponytail: moves categories + subscriptions only; add ItemState/Preference here when Phase 3/6 create them.
export default async function moveGuestData(fromUserId: string, toUserId: string) {
  await prisma.$transaction(async (tx) => {
    const [guestCategories, targetCategories, guestSubscriptions] = await Promise.all([
      tx.category.findMany({ where: { userId: fromUserId }, select: categoryFields }),
      tx.category.findMany({ where: { userId: toUserId }, select: categoryFields }),
      tx.subscription.findMany({
        where: { userId: fromUserId },
        select: { feedId: true, categoryId: true, title: true },
      }),
    ]);

    const plan = planCategoryMerge(guestCategories, targetCategories);
    const created = await tx.category.createManyAndReturn({
      data: plan.create.map(({ name, position }) => ({ userId: toUserId, name, position })),
      select: { id: true, name: true },
    });
    const createdByName = new Map(created.map(({ id, name }) => [name, id]));
    const categoryMap = new Map(
      guestCategories.map(({ id, name }) => [
        id,
        plan.reuse[id] ?? createdByName.get(name.trim()) ?? null,
      ])
    );

    await tx.subscription.createMany({
      data: guestSubscriptions.map(({ feedId, categoryId, title }) => ({
        userId: toUserId,
        feedId,
        title,
        categoryId: categoryId ? (categoryMap.get(categoryId) ?? null) : null,
      })),
      skipDuplicates: true,
    });
  });
}
