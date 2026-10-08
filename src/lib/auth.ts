import 'server-only';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { anonymous } from 'better-auth/plugins';
import prisma from '@/lib/db';
import seedGuest from '@/lib/guest';

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  plugins: [anonymous(), nextCookies()],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if ('isAnonymous' in user && user.isAnonymous === true) await seedGuest(user.id);
        },
      },
    },
  },
});

export default auth;
