import 'server-only';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { anonymous } from 'better-auth/plugins';
import prisma from '@/lib/db';
import sendEmail from '@/lib/email';
import seedGuest from '@/lib/guest';
import moveGuestData from '@/lib/guest-link';

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Reset your Frontpage password',
        text: `Someone asked to reset the password for this Frontpage account.\n\nReset it here (valid for 1 hour): ${url}\n\nIf this wasn't you, ignore this email.`,
      });
    },
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    customRules: {
      '/sign-in/anonymous': { window: 60, max: 5 },
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 60, max: 5 },
      '/request-password-reset': { window: 300, max: 3 },
    },
  },
  plugins: [
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await moveGuestData(anonymousUser.user.id, newUser.user.id);
      },
    }),
    nextCookies(),
  ],
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
