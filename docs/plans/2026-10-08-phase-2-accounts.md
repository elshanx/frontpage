# Phase 2: Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> On approval, Task 0 copies this file to `RSS-feed-reader/docs/plans/2026-10-08-phase-2-accounts.md` (in the worktree `/Users/elshanx/dev/projects/fem-rss-feed-reader`, branch `rss-feed-reader`) and commits it. Execution runs from that copy.

## Context

Phase 1 shipped the feed library, the schema, anonymous guests seeded with the 19 curated feeds, and a bare `/app` list. All of that is on branch `rss-feed-reader`, 43 tests green. Phase 2 makes accounts real:
- Spec Core 9: sign up, sign in, sign out, password reset, persistent sessions, protected routes.
- Spec Core 11: gentle prompts to sign up, session-scoped guest data, clear messaging about what signing up unlocks.

It also closes two risks the Phase 1 review raised.

**Risk 1: guest data is deleted on sign-up.** By default, Better Auth's anonymous plugin deletes the guest user right after linking (`node_modules/better-auth/dist/plugins/anonymous/index.mjs:196-207`), and the guest's categories and subscriptions cascade with it. So data has to move inside `onLinkAccount`, before that delete.

**Risk 2: auth endpoints have no effective rate limit.** Better Auth's default rate limiter is in-memory, which does nothing on serverless. `/api/auth/sign-up/email` is already open. Phase 1 deferred this as Minor 8.

**Outcome:**
- A guest can create an account, or sign in to an existing one, and keep every feed and category.
- Signed-out visits to `/app` go to `/sign-in`.
- Password reset works: the link is logged to the console in dev and sent through Resend when a key is set.
- Guests older than 24 h are purged daily.

## Global Constraints

- Inherit the roadmap and Phase 1 constraints: Next 16 (`proxy.ts`, async `cookies()`/`headers()`/`searchParams`), Prisma 7, pnpm, airbnb ESLint + Prettier, default export for single-export files, no comments except a non-obvious *why*.
- Pure modules under test use relative `.ts` imports and `import type`, never `@/`. New pure modules live in `src/lib/accounts/`. Add that folder to the `project/node-test-modules` files glob in `eslint.config.mjs`.
- Verify with `pnpm lint` exit code, **not piped**. Phase 1 learned that `pnpm -s eslint … | tail` hides failures.
- Better Auth 1.7.7 client methods:
  - `authClient.signUp.email({ name, email, password })`
  - `authClient.signIn.email({ email, password })`
  - `authClient.signOut()`
  - `authClient.requestPasswordReset({ email, redirectTo })`
  - `authClient.resetPassword({ newPassword, token })`
  - `getSessionCookie` from `better-auth/cookies`
- Passwords: 8–128 chars (Better Auth defaults). Reset tokens expire in 1 h. Revoke other sessions on reset.
- No new dependencies. Email goes through `fetch` to `https://api.resend.com/emails`.
- Guest lifetime: 24 h from `user.createdAt`.

## Review Focus

1. **Guest signs in to an existing account that already has some of the same feeds or category names.** Expect a merge with no duplicates and no unique-constraint crash. The existing account's category wins for a shared feed. Pinned in Task 2 (`planCategoryMerge` test) and Task 4 manual check.
2. **Open redirect through `?next=`.** `//evil.com`, `https://evil.com`, `/\evil.com` and `javascript:` must all fall back to `/app`. Pinned in Task 1 (`safeNextPath` test).
3. **Account enumeration.** "Forgot password" shows the same confirmation whether or not the email exists. Sign-in errors say "Email or password is incorrect", never "no such user". Pinned in Task 5/6 copy and manual check.
4. **Cron endpoint called without, or with a wrong, secret.** Expect 401 and nothing deleted, including when `CRON_SECRET` is unset. Pinned in Task 1 (`isCronAuthorized` test).
5. **Signed-in (non-guest) user opens `/sign-in`.** Redirect to `/app`. A guest on `/sign-up` still sees the form. Pinned in Task 6 manual check.

## File Structure

```
RSS-feed-reader/
├── vercel.json                                  cron schedule                      (T8)
├── prisma/schema.prisma                         + RateLimit model                  (T3)
└── src/
    ├── proxy.ts                                 optimistic /app → /sign-in redirect (T7)
    ├── lib/
    │   ├── accounts/
    │   │   ├── forms.ts      signUpSchema, signInSchema, emailSchema, resetSchema, safeNextPath, fieldErrors (T1)
    │   │   ├── cron.ts       isCronAuthorized(header, secret)                       (T1)
    │   │   ├── merge.ts      planCategoryMerge(guest, target)                        (T2)
    │   │   └── *.test.ts
    │   ├── env.ts            + RESEND_API_KEY?, EMAIL_FROM?, CRON_SECRET?            (T3)
    │   ├── email.ts          sendEmail({ to, subject, text })                        (T3)
    │   ├── auth.ts           rate limit, reset email, onLinkAccount                  (T3, T4)
    │   ├── guest-link.ts     moveGuestData(fromUserId, toUserId)   [server-only]     (T4)
    │   ├── guests.ts         purgeExpiredGuests(now)               [server-only]     (T8)
    │   └── session.ts        requireUser → /sign-in, redirectSignedIn()              (T6)
    ├── components/
    │   ├── TextField.tsx     labelled input + aria-describedby error                 (T5)
    │   ├── SignUpForm.tsx, SignInForm.tsx, ForgotPasswordForm.tsx, ResetPasswordForm.tsx (T5)
    │   ├── SignOutButton.tsx                                                         (T7)
    │   └── GuestBanner.tsx                                                           (T7)
    └── app/
        ├── (auth)/layout.tsx                    centered card shell                  (T6)
        ├── (auth)/sign-in/page.tsx, sign-up/page.tsx, forgot-password/page.tsx, reset-password/page.tsx (T6)
        ├── app/layout.tsx                       session check + header + guest banner (T7)
        ├── api/cron/maintenance/route.ts                                             (T8)
        └── page.tsx                             + Sign up / Sign in links            (T6)
```

---

### Task 0: Save the plan

- [ ] Copy this file to `RSS-feed-reader/docs/plans/2026-10-08-phase-2-accounts.md`.
- [ ] Commit it: `git commit -m "Add Phase 2 accounts plan"`.

### Task 1: Form validation, safe redirects, cron auth (pure, TDD)

**Files:** create `src/lib/accounts/forms.ts`, `src/lib/accounts/cron.ts` and their tests. Modify `eslint.config.mjs` to add `src/lib/accounts/**/*.ts` to `project/node-test-modules`.

**Produces:**
```ts
// forms.ts
export const signUpSchema: z.ZodObject<{ name; email; password }>;   // name 1–80 trimmed, email lowercased/trimmed, password 8–128
export const signInSchema: z.ZodObject<{ email; password }>;          // password min 1
export const emailSchema: z.ZodObject<{ email }>;
export const resetSchema: z.ZodObject<{ password; confirm }>;         // refine: confirm === password, path ['confirm']
export function fieldErrors(error: z.ZodError): Record<string, string>; // first message per field
export function safeNextPath(value: string | null | undefined): string; // same-origin path or '/app'
// cron.ts
export default function isCronAuthorized(header: string | null, secret: string | undefined): boolean;
```

- [ ] **Step 1: write the failing tests.**

`forms.test.ts`:
```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fieldErrors, resetSchema, safeNextPath, signInSchema, signUpSchema } from './forms.ts';

test('signUpSchema normalizes email and enforces password length', () => {
  const ok = signUpSchema.parse({ name: ' Ana ', email: ' Ana@Example.COM ', password: 'longenough' });
  assert.deepEqual(ok, { name: 'Ana', email: 'ana@example.com', password: 'longenough' });
  const bad = signUpSchema.safeParse({ name: '', email: 'nope', password: 'short' });
  assert.equal(bad.success, false);
  if (!bad.success) assert.deepEqual(Object.keys(fieldErrors(bad.error)).sort(), ['email', 'name', 'password']);
});

test('signInSchema only requires a non-empty password', () => {
  assert.equal(signInSchema.safeParse({ email: 'a@b.co', password: 'x' }).success, true);
  assert.equal(signInSchema.safeParse({ email: 'a@b.co', password: '' }).success, false);
});

test('resetSchema requires matching passwords and reports on confirm', () => {
  const bad = resetSchema.safeParse({ password: 'longenough', confirm: 'different1' });
  assert.equal(bad.success, false);
  if (!bad.success) assert.ok(fieldErrors(bad.error).confirm);
});

test('safeNextPath only allows same-origin paths', () => {
  assert.equal(safeNextPath('/app?feed=1'), '/app?feed=1');
  ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '', null, undefined, 'app']
    .forEach((value) => assert.equal(safeNextPath(value), '/app', String(value)));
});
```

`cron.test.ts`:
```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import isCronAuthorized from './cron.ts';

test('isCronAuthorized requires the exact bearer secret', () => {
  assert.equal(isCronAuthorized('Bearer s3cret-value', 's3cret-value'), true);
  assert.equal(isCronAuthorized('Bearer wrong', 's3cret-value'), false);
  assert.equal(isCronAuthorized(null, 's3cret-value'), false);
  assert.equal(isCronAuthorized('Bearer ', ''), false);
  assert.equal(isCronAuthorized('Bearer anything', undefined), false);
});
```

- [ ] **Step 2:** run `node --test src/lib/accounts/*.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: implement.**

`forms.ts`:
```ts
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
```

`cron.ts`:
```ts
import { timingSafeEqual } from 'node:crypto';

export default function isCronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

- [ ] **Step 4:** run `pnpm test`. Expected: all pass (43 + 5). Then `pnpm lint` exit 0.
- [ ] **Step 5:** commit: "Add account form schemas, safe redirect paths and cron auth check".

### Task 2: Category merge planning (pure, TDD)

**Files:** create `src/lib/accounts/merge.ts` and `merge.test.ts`.

**Produces:**
```ts
export interface CategoryRef { id: string; name: string; position: number }
export interface CategoryMergePlan { create: { name: string; position: number }[]; reuse: Record<string, string> } // reuse: guestCategoryId → targetCategoryId
export default function planCategoryMerge(guest: CategoryRef[], target: CategoryRef[]): CategoryMergePlan;
```

Rules:
- A category name that matches case-insensitively after trimming maps to the existing target category.
- New categories are appended after the target's highest position, keeping the guest's relative order.

- [ ] **Step 1: write the failing test.**
```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import planCategoryMerge from './merge.ts';

const cat = (id: string, name: string, position: number) => ({ id, name, position });

test('reuses same-named categories and appends new ones in guest order', () => {
  const plan = planCategoryMerge(
    [cat('g1', 'Design', 0), cat('g2', 'AI & ML', 1), cat('g3', ' frontend ', 2)],
    [cat('t1', 'Frontend', 0), cat('t2', 'Reading', 4)]
  );
  assert.deepEqual(plan.reuse, { g3: 't1' });
  assert.deepEqual(plan.create, [{ name: 'Design', position: 5 }, { name: 'AI & ML', position: 6 }]);
});

test('an empty target account takes the guest categories as-is', () => {
  const plan = planCategoryMerge([cat('g1', 'Design', 0)], []);
  assert.deepEqual(plan, { create: [{ name: 'Design', position: 0 }], reuse: {} });
});
```
- [ ] **Step 2:** run it. Expected: FAIL.
- [ ] **Step 3: implement.**
```ts
export interface CategoryRef { id: string; name: string; position: number }
export interface CategoryMergePlan {
  create: { name: string; position: number }[];
  reuse: Record<string, string>;
}

const key = (name: string) => name.trim().toLowerCase();

export default function planCategoryMerge(guest: CategoryRef[], target: CategoryRef[]): CategoryMergePlan {
  const existing = new Map(target.map(({ id, name }) => [key(name), id]));
  const start = Math.max(-1, ...target.map(({ position }) => position)) + 1;
  const ordered = guest.toSorted((a, b) => a.position - b.position);
  const reuse = Object.fromEntries(
    ordered.flatMap(({ id, name }) => (existing.has(key(name)) ? [[id, existing.get(key(name))]] : []))
  );
  const create = ordered
    .filter(({ name }) => !existing.has(key(name)))
    .map(({ name }, index) => ({ name: name.trim(), position: start + index }));
  return { create, reuse };
}
```
- [ ] **Step 4:** `pnpm test` and `pnpm lint`. Expected: green.
- [ ] **Step 5:** commit: "Plan guest category merges into an existing account".

### Task 3: Env, rate-limit table, email sender, reset-password wiring

**Files:**
- Modify: `src/lib/env.ts`, `prisma/schema.prisma`, `src/lib/auth.ts`, `.env.example`
- Create: `src/lib/email.ts`

Steps:

- [ ] **Env.** Extend the zod schema:
  - `RESEND_API_KEY: z.string().optional()`
  - `EMAIL_FROM: z.string().default('Frontpage <onboarding@resend.dev>')`
  - `CRON_SECRET: z.string().min(16).optional()`

  Mirror these in `.env.example` with comments-free placeholder values.

- [ ] **Rate-limit table.** Add the model Better Auth's `get-tables.mjs` defines, then run `pnpm db:migrate --name rate_limit`. Expected: migration applied and the `rateLimit` table exists.
  ```prisma
  model RateLimit {
    id          String @id @default(uuid())
    key         String @unique
    count       Int
    lastRequest BigInt

    @@map("rateLimit")
  }
  ```

- [ ] **`src/lib/email.ts`.**
  ```ts
  import 'server-only';
  import env from '@/lib/env';

  export default async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
    if (!env.RESEND_API_KEY) {
      console.warn(`[email:dev] to=${to} subject="${subject}"\n${text}`);
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
    });
    if (!response.ok) throw new Error(`Resend rejected the email (${response.status})`);
  }
  ```

- [ ] **`auth.ts` additions.** Keep the existing `databaseHooks`.
  ```ts
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
  ```

- [ ] **Verify.** Run `pnpm typecheck` and `pnpm lint`. Both must exit 0.

  Then start `pnpm dev` and fire 6 anonymous sign-ins via curl:
  ```bash
  for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w '%{http_code} ' -X POST -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/auth/sign-in/anonymous; done
  ```
  Expected: `200 200 200 200 200 429`.

  Clean up the test guests with `psql frontpage -c 'delete from "user" where "isAnonymous"' -c 'delete from "rateLimit"'`.

- [ ] **Commit:** "Add database rate limiting and password reset email".

### Task 4: Move guest data on link

**Files:** create `src/lib/guest-link.ts`. Modify `src/lib/auth.ts` (`anonymous({ onLinkAccount })`).

**Produces:** `moveGuestData(fromUserId: string, toUserId: string): Promise<void>`. One `prisma.$transaction(async (tx) => …)`:
1. Load guest categories, target categories and guest subscriptions (with `categoryId`, `feedId`, `title`).
2. `planCategoryMerge(guestCats, targetCats)`. Then `tx.category.createManyAndReturn({ data: plan.create.map(...) with userId: toUserId })`, and build `categoryMap`: each guest category id → its reused id, or the created id matched by name.
3. `tx.subscription.createMany({ data: guestSubs.map(s => ({ userId: toUserId, feedId: s.feedId, title: s.title, categoryId: s.categoryId ? categoryMap[s.categoryId] : null })), skipDuplicates: true })`. The target's existing subscriptions win, per `@@unique([userId, feedId])`.
4. No deletes. The plugin deletes the guest right after the hook, and that cascades.

Add a `ponytail:` line: `// ponytail: moves categories + subscriptions only; add ItemState/Preference here when Phase 3/6 create them.`

```ts
plugins: [
  anonymous({
    onLinkAccount: async ({ anonymousUser, newUser }) => {
      await moveGuestData(anonymousUser.user.id, newUser.user.id);
    },
  }),
  nextCookies(),
],
```

- [ ] **Verify end to end with curl against `pnpm dev`. All four checks must pass.**
  1. **Guest → new account.**
     - Sign in as a guest and save the cookie jar.
     - With that jar, `POST /api/auth/sign-up/email {"name":"Ana","email":"ana@test.dev","password":"longenough"}`. Expected: 200.
     - SQL: user `ana@test.dev` has 19 subscriptions and 5 categories, and no anonymous users remain.
  2. **Guest → existing account with overlap.**
     - Create `bo@test.dev` and give it a `Frontend` category plus 1 subscription to the CSS-Tricks feed, via SQL or a guest-then-signup run.
     - Start a new guest, then `POST /api/auth/sign-in/email` as `bo`.
     - Expected:
       - 19 subscriptions total, no duplicates;
       - 5 categories, with `Frontend` not duplicated;
       - the CSS-Tricks subscription keeps bo's original category;
       - no anonymous users remain.
  3. `pnpm lint && pnpm typecheck` exit 0.
  4. Clean up the test users.

- [ ] **Commit:** "Move guest categories and subscriptions into the linked account".

### Task 5: Form components

**Files:** create `src/components/TextField.tsx`, `SignUpForm.tsx`, `SignInForm.tsx`, `ForgotPasswordForm.tsx` and `ResetPasswordForm.tsx`.

**Pattern.** All four forms are client components. Each one:
- holds `values` and `errors` state, and validates on submit with its Task 1 schema;
- calls the Better Auth client inside `useTransition`;
- keeps entered values on error;
- shows server errors in a `role='alert'` paragraph.

**`TextField`:** `{ label, name, type, value, onChange, error, autoComplete, required }`. It renders:
- a `<label htmlFor>`;
- an `<input id aria-invalid aria-describedby={error ? `${id}-error` : undefined} aria-required>`;
- an error `<p id={`${id}-error`}>`.

It uses brand tokens: `min-h-11`, `border-border`, focus ring `accent`.

**Copy and behaviour per form:**
- **Sign up:**
  - Fields: name, email, password (`autoComplete='new-password'`).
  - On success: `router.push(safeNextPath(next))`.
  - On a `USER_ALREADY_EXISTS` error code: "An account with this email already exists. Sign in instead?", with a link.
- **Sign in:**
  - Every failure shows "Email or password is incorrect."
  - 429 shows "Too many attempts. Try again in a minute."
  - Links to "Forgot password?" and "Create an account".
- **Forgot password:**
  - Calls `requestPasswordReset({ email, redirectTo: '/reset-password' })`.
  - Always shows "If an account exists for that email, we've sent a reset link. It expires in 1 hour.", regardless of the result.
- **Reset password:**
  - Gets the `token` prop from the page.
  - Missing token, or `?error=INVALID_TOKEN`: show "This reset link is invalid or has expired" and a link to request a new one.
  - Success: `router.push('/sign-in?reset=1')`.

- [ ] **Verify:** `pnpm lint` (jsx-a11y included) and `pnpm typecheck` exit 0.
- [ ] **Commit:** "Add accessible sign-up, sign-in and password reset forms".

### Task 6: Auth pages and session helpers

**Files:**
- Create: `src/app/(auth)/layout.tsx` and the four pages.
- Modify: `src/lib/session.ts`, `src/app/page.tsx`.

**`session.ts`:**
- `requireUser()` redirects to `/sign-in` (it was `/`).
- Add `redirectSignedIn()`: if the session exists and `!session.user.isAnonymous`, `redirect('/app')`.
- Pages call it at the top of sign-in, sign-up and forgot-password.

**Pages.** Each is an async Server Component. It reads `searchParams` (a Promise in Next 16), sets `metadata.title` (`Sign in`, `Create your account`, `Forgot password`, `Reset password`), and renders an `<h1>` and the form.
- Sign-in passes `next` and shows a "Password updated — sign in with your new password" notice when `reset=1`.
- Sign-up shows a guest-aware subtitle when the current session is anonymous: "Your 19 feeds and categories come with you."

**`(auth)/layout.tsx`:** `<main id='main'>`, centered `max-w-sm` card, a "Frontpage" home link.

**Landing page.** Next to `GuestButton`, add a "Create an account" link to `/sign-up` and a "Sign in" link. Phase 10 does the real landing design.

- [ ] **Verify in the browser** (dev server, Claude-in-Chrome or manual):
  - Sign up a new account and land on `/app`.
  - Sign out (Task 7) and sign in.
  - Visiting `/sign-in` while signed in redirects to `/app`.
  - A wrong password shows the generic error.
  - Forgot password logs a `[email:dev]` link in the server log. Opening it lands on `/reset-password?token=…`. Setting a new password sends you to `/sign-in?reset=1`, and the old password then fails.
  - `/reset-password?error=INVALID_TOKEN` shows the expired-link message.
  - `/sign-in?next=//evil.com` goes to `/app` after sign-in.
- [ ] **Commit:** "Add sign-in, sign-up and password reset pages".

### Task 7: Protect `/app`, header, sign-out, guest banner

**Files:**
- Create: `src/proxy.ts`, `src/app/app/layout.tsx`, `src/components/SignOutButton.tsx`, `src/components/GuestBanner.tsx`
- Unchanged: `src/app/app/page.tsx` keeps its own `requireUser()` call, because layouts can't pass props to pages. The duplicate `getSession` is one cheap lookup per request.

**`proxy.ts`:**
```ts
import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const url = new URL('/sign-in', request.url);
  url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/app/:path*'] };
```

**`app/layout.tsx`:**
- Calls `requireUser()`. This is the authoritative check; the proxy is only optimistic.
- Renders a `<header>` with the Frontpage wordmark.
- For guests, the header shows a "Create account" link to `/sign-up`. For accounts, it shows the user's name and `SignOutButton`.
- Renders `GuestBanner` when `user.isAnonymous`.

**`GuestBanner`** is a slim `role='region' aria-label='Guest mode'` bar that never blocks anything. Copy: "You're exploring as a guest. Your feeds and reading progress are kept for 24 hours — **create a free account** to keep them, add your own feeds and sync across devices." This covers spec §11: what signing up unlocks.

**`SignOutButton`** is a client component: `authClient.signOut()`, then `router.push('/')` and `router.refresh()`.

**Prisma note.** `isAnonymous` comes from the Better Auth session user type. If it isn't on the inferred type, read it with `'isAnonymous' in user && user.isAnonymous === true`, matching `auth.ts`.

- [ ] **Verify:**
  - With cookies cleared, `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://localhost:3000/app?feed=1` gives `307 …/sign-in?next=%2Fapp%3Ffeed%3D1`.
  - In the browser:
    - A guest sees the banner and the "Create account" link.
    - An account sees its name and Sign out.
    - Sign out lands on `/`.
    - Going back to `/app` redirects to sign-in.
  - `pnpm lint && pnpm typecheck && pnpm build` exit 0.
- [ ] **Commit:** "Protect /app with a proxy and add header, sign-out and guest banner".

### Task 8: Daily guest purge

**Files:** create `src/lib/guests.ts`, `src/app/api/cron/maintenance/route.ts` and `vercel.json`.

**`guests.ts`:**
```ts
import 'server-only';
import prisma from '@/lib/db';

const GUEST_LIFETIME_MS = 24 * 60 * 60 * 1000;

export default async function purgeExpiredGuests(now: Date) {
  const { count } = await prisma.user.deleteMany({
    where: { isAnonymous: true, createdAt: { lt: new Date(now.getTime() - GUEST_LIFETIME_MS) } },
  });
  return count;
}
```

**`route.ts`:**
```ts
import env from '@/lib/env';
import isCronAuthorized from '@/lib/accounts/cron';
import purgeExpiredGuests from '@/lib/guests';

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'), env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const purgedGuests = await purgeExpiredGuests(new Date());
  return Response.json({ purgedGuests });
}
```

**`vercel.json`:** `{ "crons": [{ "path": "/api/cron/maintenance", "schedule": "0 4 * * *" }] }`. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when that env var is set.

Phase 6 extends this route with feed refresh, orphan-feed and old-item cleanup.

- [ ] **Verify:**
  - Set `CRON_SECRET` in `.env`.
  - Create 2 guests, then age one: `update "user" set "createdAt" = now() - interval '25 hours' where id = …`.
  - `curl` with no header gives 401, and both guests still exist.
  - `curl -H "Authorization: Bearer $CRON_SECRET"` gives `{"purgedGuests":1}`. The aged guest and its 19 subscriptions are gone; the fresh guest remains.
  - `pnpm lint && pnpm typecheck && pnpm test && pnpm build` exit 0.
- [ ] **Commit:** "Purge guests older than 24 hours via a daily cron".

---

## Deferred (not Phase 2)

- Phase 1 security Minors (SSRF ranges, DNS rebinding pin, DNS timeout) → Phase 4, before user-supplied URLs.
- Email verification: not required by spec. Better Auth supports it later via `emailVerification.sendVerificationEmail`.
- Moving guest `ItemState`/`Preference` → extend `moveGuestData` when Phases 3/6 create those tables (ponytail marker in code).
- Production email requires a Resend-verified domain. Document in the README (Phase 10).

## Verification (end of phase)

1. Run `pnpm test`. Expected: 43 Phase 1 tests plus 7 new (forms 4, cron 1, merge 2), all green.
2. `pnpm lint`, `pnpm typecheck` and `pnpm build` all exit 0, each run unpiped.
3. Manual guest → account flows from Task 4 (new account and existing-account merge) pass. Check the SQL counts.
4. Browser walk-through from Tasks 6–7: sign-up, sign-in, sign-out, forgot/reset via the dev console link, protected-route redirect with `next`, guest banner.
5. Cron purge from Task 8: 401 without the secret, purges only guests older than 24 h.
6. Final whole-branch review (fresh reviewer, most capable model) with this Review Focus list, then one TDD fix pass.
