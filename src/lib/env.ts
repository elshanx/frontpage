import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Frontpage <onboarding@resend.dev>'),
  CRON_SECRET: z.string().min(16).optional(),
  GEMINI_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(
  Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''))
);

if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
}

export default parsed.data;
