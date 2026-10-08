import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));
const newPassword = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters');

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80, 'Use at most 80 characters'),
  email,
  password: newPassword,
});
export const signInSchema = z.object({ email, password: z.string().min(1, 'Enter your password') });
export const emailSchema = z.object({ email });
export const resetSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine(({ password, confirm }) => password === confirm, {
    message: "Passwords don't match",
    path: ['confirm'],
  });

export function fieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.toReversed().map(({ path, message }) => [String(path[0]), message])
  );
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/app';
  return value;
}
