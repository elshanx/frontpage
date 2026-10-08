import 'server-only';
import { starterPacks, subscribeStarterPack } from '@/lib/subscriptions';

export default async function seedGuest(userId: string) {
  await Promise.all(
    starterPacks.map(({ name }, position) => subscribeStarterPack(userId, name, position))
  );
}
