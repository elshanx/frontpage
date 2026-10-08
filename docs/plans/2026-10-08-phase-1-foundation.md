# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Next.js app where "Try as guest" creates an anonymous user seeded with the 19 curated feeds, and `/app` shows real, parsed, sanitized items fetched server-side.

**Architecture:** A pure feed library in `src/lib/feeds/` (dates → decode → html → parse, plus fetch, health, ingest) unit-tested with `node --test`. A server-only refresh service writes shared `Feed`/`Item` rows via Prisma. Better Auth (anonymous plugin) owns users and sessions, and a `databaseHooks.user.create.after` hook seeds guests. `/app` is a Server Component that awaits never-fetched feeds inside `<Suspense>` and schedules due feeds with `after()`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Prisma 7 + `@prisma/adapter-pg`, Postgres.app, Better Auth, htmlparser2/domutils/domhandler/entities, sanitize-html, zod, pnpm, Node 24.

**Spec:** `docs/plans/2026-10-08-frontpage-roadmap.md` (read its Global Constraints, they apply here), `spec/core-requirements.md` §2, §8, §11, §12, `spec/technical-requirements.md`, `data/README.md`.

All paths are relative to `RSS-feed-reader/` inside the worktree `/Users/elshanx/dev/projects/fem-rss-feed-reader`. Run every command from `RSS-feed-reader/`.

## Global Constraints

- Inherit everything in the roadmap's Global Constraints.
- Modules under `src/lib/feeds/` are imported by tests, so they use **relative `.ts` imports** and **`import type`** for types, never `@/`. Anything that needs `@/` (Prisma, auth) lives outside `src/lib/feeds/`.
- Feed fetch limits: `TIMEOUT_MS = 10_000`, `MAX_REDIRECTS = 5`, `MAX_BYTES = 5 * 1024 * 1024`, refresh interval 15 min, backoff `15 min × 2^(failures−1)` capped at 24 h, manual refresh no more than once per 60 s, refresh pool size 6, max 200 items stored per fetch.
- Health: `stale` = no item newer than 30 days. `dead` = 10 consecutive failures, or 3 consecutive *permanent* failures (404/410/not-a-feed/invalid URL).

## Review Focus

1. **XSS through feed HTML or links**: `<script>`, inline handlers and `javascript:` URLs in content, item links or image URLs. Pinned in Task 4 (sanitizer) and Task 5 (`javascript:` item link → `url: null`).
2. **SSRF via user-supplied feed URLs**: `127.0.0.1`, `169.254.169.254`, IPv4-mapped IPv6, and a public URL that redirects to a private one. Pinned in Task 6.
3. **Hanging or huge responses**: a server that never responds, or a > 5 MB body. Expect a `timeout` / `too-large` error within budget, never a hang or OOM. Pinned in Task 6.
4. **Truncated / HTML-instead-of-XML feeds**: a partial parse yields the complete items, and a web page yields "returned a web page, not a feed". Pinned in Task 5.
5. **Mislabeled encodings**: Windows-1252 bytes served as UTF-8 should still show `’` and `é`, not `�`. Pinned in Task 3.

## File Structure

```
RSS-feed-reader/
├── package.json, tsconfig.json, next.config.ts, postcss.config.mjs, eslint.config.mjs,
│   .prettierrc.json, .prettierignore, prisma.config.ts, .env.example          (Task 1, 8)
├── prisma/schema.prisma                                                       (Task 8)
├── src/app/
│   ├── layout.tsx, globals.css, tokens.css, page.tsx                          (Task 1, 10)
│   ├── api/auth/[...all]/route.ts                                             (Task 10)
│   └── app/page.tsx                                                           (Task 11)
├── src/components/GuestButton.tsx, ItemList.tsx                               (Task 10, 11)
└── src/lib/
    ├── env.ts, db.ts                                                          (Task 8)
    ├── auth.ts, auth-client.ts, session.ts, guest.ts                          (Task 10)
    ├── items.ts                                                               (Task 11)
    ├── refresh.ts      refreshFeed(id, opts), refreshFeeds(ids, opts)  [server-only, uses @/] (Task 9)
    └── feeds/
        ├── dates.ts        parseDate(raw) → Date | null                        (Task 2)
        ├── decode.ts       decodeFeed(bytes, contentType) → string             (Task 3)
        ├── html.ts         sanitizeContent, toPlainText, toExcerpt, cleanText,
        │                   firstImage, httpUrl                                 (Task 4)
        ├── parse.ts        parseFeed(xml, feedUrl?) → ParsedFeed               (Task 5)
        ├── fetch.ts        fetchFeed(url, options) → FetchResult, isPrivateAddress (Task 6)
        ├── health.ts       feedHealth(feed, now), nextFetchAt(failCount, now)  (Task 7)
        ├── ingest.ts       toItemRows(feedId, items, fetchedAt), latestPublished (Task 9)
        └── *.test.ts
```

---

### Task 1: Scaffold the app

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/tokens.css`, `src/app/page.tsx`
- Modify: `.gitignore` (append `src/generated/`)

**Interfaces:**
- Produces: `pnpm dev|build|lint|typecheck|test|db:migrate` scripts. Tailwind theme classes `bg-bg-primary`, `text-text-primary|secondary|tertiary`, `border-border`, `max-w-feed`, `max-w-content`, `font-sans|serif|mono`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "frontpage",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "postinstall": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "test": "node --test 'src/**/*.test.ts'",
    "vercel-build": "prisma migrate deploy && next build",
    "typecheck": "next typegen && tsc --noEmit",
    "format": "prettier --write ."
  }
}
```

- [ ] **Step 2: Install dependencies**

Prisma's `postinstall` fails until Task 8 adds a schema, so skip scripts for now:

```bash
pnpm add --ignore-scripts next react react-dom @prisma/client @prisma/adapter-pg pg better-auth zod server-only htmlparser2 domutils domhandler entities sanitize-html
pnpm add -D --ignore-scripts typescript @types/node @types/react @types/react-dom @types/pg @types/sanitize-html prisma dotenv tailwindcss @tailwindcss/postcss eslint @eslint/js @eslint/compat eslint-config-airbnb-extended eslint-config-prettier prettier prettier-plugin-tailwindcss
```

- [ ] **Step 3: Copy tooling config from `../todo-app`**

```bash
cp ../../fem/todo-app/tsconfig.json ../../fem/todo-app/postcss.config.mjs ../../fem/todo-app/.prettierrc.json ../../fem/todo-app/.prettierignore ../../fem/todo-app/next.config.ts ../../fem/todo-app/eslint.config.mjs .
printf '\n# Prisma client\nsrc/generated/\n' >> .gitignore
```

(`../../fem/todo-app` resolves from the worktree's `RSS-feed-reader/` to the main checkout. Use `/Users/elshanx/dev/projects/fem/todo-app` if in doubt.)

Then, in `eslint.config.mjs`, widen the `project/tests` block so feed-library modules may (and must) use `.ts` extensions:

```js
  {
    name: 'project/node-test-modules',
    files: ['**/*.test.ts', 'src/lib/feeds/**/*.ts'],
    rules: {
      'import-x/extensions': ['error', 'ignorePackages', { ts: 'always' }],
    },
  },
```

(It replaces the existing `project/tests` block. Keep all other blocks unchanged.)

- [ ] **Step 4: Tokens with contrast fixes**

```bash
cp starter/tokens.css src/app/tokens.css
```

Edit `src/app/tokens.css`. In the light `:root` block, change `--color-text-tertiary: #8b949e;` → `#656d76;`, `--color-success: #16a34a;` → `#15803d;` and `--color-warning: #ca8a04;` → `#a16207;`. In the dark block, change `--color-text-tertiary: #6e7681;` → `#848d97;`.

- [ ] **Step 5: Write `src/app/globals.css`**

```css
@import 'tailwindcss';
@import './tokens.css';

@theme inline {
  --color-bg-primary: var(--color-bg-primary);
  --color-bg-secondary: var(--color-bg-secondary);
  --color-bg-tertiary: var(--color-bg-tertiary);
  --color-surface: var(--color-surface);
  --color-border: var(--color-border);
  --color-border-subtle: var(--color-border-subtle);
  --color-text-primary: var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-text-tertiary: var(--color-text-tertiary);
  --color-accent: var(--color-accent);
  --color-accent-hover: var(--color-accent-hover);
  --color-accent-subtle: var(--color-accent-subtle);
  --color-success: var(--color-success);
  --color-warning: var(--color-warning);
  --color-error: var(--color-error);
  --color-unread: var(--color-unread-indicator);

  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);

  --font-sans: var(--font-inter), system-ui, -apple-system, sans-serif;
}

@theme {
  --font-serif: 'Georgia', 'Charter', serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;

  --text-xs: 0.6875rem;
  --text-xs--line-height: 1.45;
  --text-sm: 0.8125rem;
  --text-sm--line-height: 1.45;
  --text-base: 1rem;
  --text-base--line-height: 1.55;
  --text-lg: 1.25rem;
  --text-lg--line-height: 1.4;
  --text-xl: 1.5625rem;
  --text-xl--line-height: 1.3;
  --text-2xl: 1.9375rem;
  --text-2xl--line-height: 1.25;
  --text-3xl: 2.4375rem;
  --text-3xl--line-height: 1.2;

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  --spacing-sidebar: 16.25rem;
  --container-content: 45rem;
  --container-feed: 60rem;
  --container-page: 80rem;
}

@layer base {
  body {
    @apply bg-bg-primary font-sans text-text-primary antialiased;
  }

  :focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

- [ ] **Step 6: Write `src/app/layout.tsx` and a placeholder `src/app/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Frontpage', template: '%s · Frontpage' },
  description: 'Your personalized front page for tech content.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang='en' className={inter.variable}>
      <body>
        <a
          href='#main'
          className='sr-only rounded-md bg-accent px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50'
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
```

```tsx
export default function Home() {
  return (
    <main id='main' className='grid min-h-dvh place-items-center px-4'>
      <h1 className='text-3xl font-bold'>Frontpage</h1>
    </main>
  );
}
```

- [ ] **Step 7: Verify**

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: all pass. `pnpm build` prints the `/` route as static.

- [ ] **Step 8: Commit**

```bash
git add .gitignore package.json pnpm-lock.yaml tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs .prettierrc.json .prettierignore src/app data/sample-feeds.json data/sample-feeds.opml starter docs
git commit -m "Scaffold Frontpage Next.js app with brand tokens"
```

---

### Task 2: Date parsing

**Files:**
- Create: `src/lib/feeds/dates.ts`
- Test: `src/lib/feeds/dates.test.ts`

**Interfaces:**
- Produces: `parseDate(raw: string | null | undefined): Date | null`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDate } from './dates.ts';

const iso = (raw: string | null | undefined) => parseDate(raw)?.toISOString() ?? null;

test('parses ISO 8601 with Z and offsets', () => {
  assert.equal(iso('2024-01-15T10:30:00Z'), '2024-01-15T10:30:00.000Z');
  assert.equal(iso('2024-01-15T10:30:00+02:00'), '2024-01-15T08:30:00.000Z');
});

test('treats ISO-like dates without a zone as UTC', () => {
  assert.equal(iso('2024-01-15 10:30:00'), '2024-01-15T10:30:00.000Z');
  assert.equal(iso('2024-01-15T10:30'), '2024-01-15T10:30:00.000Z');
  assert.equal(iso('2024-01-15'), '2024-01-15T00:00:00.000Z');
});

test('parses RFC 822 / 2822 variants', () => {
  assert.equal(iso('Mon, 15 Jan 2024 10:30:00 GMT'), '2024-01-15T10:30:00.000Z');
  assert.equal(iso('Mon, 15 Jan 2024 10:30:00 -0500'), '2024-01-15T15:30:00.000Z');
  assert.equal(iso('Mon, 15 Jan 2024 10:30:00 EST'), '2024-01-15T15:30:00.000Z');
  assert.equal(iso('15 Jan 2024 10:30:00 GMT'), '2024-01-15T10:30:00.000Z');
  assert.equal(iso('Fri, 15 Jan 2024 10:30:00 GMT'), '2024-01-15T10:30:00.000Z');
  assert.equal(iso('Mon,  15 Jan 2024   10:30:00 GMT '), '2024-01-15T10:30:00.000Z');
});

test('maps zone abbreviations JavaScript does not know', () => {
  assert.equal(iso('Tue, 16 Jul 2024 10:30:00 CEST'), '2024-07-16T08:30:00.000Z');
  assert.equal(iso('Tue, 16 Jul 2024 10:30:00 IST'), '2024-07-16T05:00:00.000Z');
});

test('returns null for missing or unusable dates', () => {
  assert.equal(iso(undefined), null);
  assert.equal(iso(null), null);
  assert.equal(iso('   '), null);
  assert.equal(iso('not a date'), null);
  assert.equal(iso('1970-01-01T00:00:00Z'), null);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test src/lib/feeds/dates.test.ts`
Expected: FAIL. `Cannot find module './dates.ts'`.

- [ ] **Step 3: Implement**

```ts
const ZONE_OFFSETS: Record<string, string> = {
  UTC: '+0000',
  WET: '+0000',
  CET: '+0100',
  CEST: '+0200',
  BST: '+0100',
  EET: '+0200',
  EEST: '+0300',
  IST: '+0530',
  JST: '+0900',
  KST: '+0900',
  AEST: '+1000',
  AEDT: '+1100',
};
const NAIVE_ISO = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;
const LEADING_WEEKDAY = /^[a-z]+,\s*/i;
const TRAILING_ZONE = /\b([A-Z]{3,4})$/;
const MIN_YEAR = 1990;

export function parseDate(raw: string | null | undefined): Date | null {
  const text = raw?.trim().replace(/\s+/g, ' ');
  if (!text) return null;

  let normalized = text
    .replace(LEADING_WEEKDAY, '')
    .replace(TRAILING_ZONE, (zone) => ZONE_OFFSETS[zone] ?? zone);
  if (NAIVE_ISO.test(normalized)) {
    normalized =
      normalized.length === 10 ? `${normalized}T00:00:00Z` : `${normalized.replace(' ', 'T')}Z`;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < MIN_YEAR) return null;
  return date;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/feeds/dates.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/feeds/dates.ts src/lib/feeds/dates.test.ts
git commit -m "Add feed date parser for ISO 8601, RFC 822 and naive dates"
```

---

### Task 3: Byte decoding

**Files:**
- Create: `src/lib/feeds/decode.ts`
- Test: `src/lib/feeds/decode.test.ts`

**Interfaces:**
- Produces: `decodeFeed(bytes: Uint8Array, contentType: string | null): string`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeFeed } from './decode.ts';

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => [...Buffer.from(text, 'latin1')];

test('decodes UTF-8 by default', () => {
  assert.equal(decodeFeed(new TextEncoder().encode('<t>café ’</t>'), null), '<t>café ’</t>');
});

test('uses the charset from the Content-Type header', () => {
  const latin1 = bytes(...ascii('<t>caf'), 0xe9, ...ascii('</t>'));
  assert.equal(decodeFeed(latin1, 'application/rss+xml; charset=ISO-8859-1'), '<t>café</t>');
});

test('uses the encoding from the XML declaration', () => {
  const win1252 = bytes(
    ...ascii('<?xml version="1.0" encoding="windows-1252"?><t>it'),
    0x92,
    ...ascii('s</t>')
  );
  assert.match(decodeFeed(win1252, 'text/xml'), /<t>it’s<\/t>/);
});

test('falls back to Windows-1252 when bytes labelled UTF-8 are invalid', () => {
  const mislabeled = bytes(...ascii('<t>caf'), 0xe9, 0x20, 0x92, ...ascii('</t>'));
  assert.equal(decodeFeed(mislabeled, 'text/xml; charset=utf-8'), '<t>café ’</t>');
});

test('ignores unknown charset labels', () => {
  assert.equal(decodeFeed(new TextEncoder().encode('<t>ok</t>'), 'text/xml; charset=x-bogus'), '<t>ok</t>');
});

test('honours UTF-16 byte order marks', () => {
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<t>é</t>', 'utf16le')]);
  assert.equal(decodeFeed(utf16, null), '<t>é</t>');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test src/lib/feeds/decode.test.ts`
Expected: FAIL. Module not found.

- [ ] **Step 3: Implement**

```ts
const XML_DECLARATION_ENCODING = /^<\?xml[^>]*encoding=["']([\w.:-]+)["']/i;
const HEADER_CHARSET = /charset=["']?([\w.:-]+)/i;

function byteOrderMark(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  return null;
}

function declaredCharset(bytes: Uint8Array, contentType: string | null): string | null {
  const fromHeader = contentType?.match(HEADER_CHARSET)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 256));
  return head.match(XML_DECLARATION_ENCODING)?.[1].toLowerCase() ?? null;
}

export function decodeFeed(bytes: Uint8Array, contentType: string | null): string {
  const charset = byteOrderMark(bytes) ?? declaredCharset(bytes, contentType) ?? 'utf-8';

  if (charset === 'utf-8' || charset === 'utf8') {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder('windows-1252').decode(bytes);
    }
  }

  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/feeds/decode.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/feeds/decode.ts src/lib/feeds/decode.test.ts
git commit -m "Decode feed bytes using header, XML declaration, BOM and 1252 fallback"
```

---

### Task 4: HTML sanitizing and text helpers

**Files:**
- Create: `src/lib/feeds/html.ts`
- Test: `src/lib/feeds/html.test.ts`

**Interfaces:**
- Produces:
  - `sanitizeContent(html: string, baseUrl?: string): string`: safe reader HTML (h1→h2, absolute URLs, lazy images, links open in a new tab, no scripts, handlers, ads, nav or tracking pixels)
  - `toPlainText(html: string): string`
  - `toExcerpt(html: string, max?: number): string`: plain text, at most `max` (default 280) chars plus `…`
  - `cleanText(text: string): string`: decode HTML entities, collapse whitespace (titles)
  - `firstImage(html: string): string | null`
  - `httpUrl(value: string | null | undefined, base?: string): string | null`: absolute http(s) URL or null

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanText, firstImage, httpUrl, sanitizeContent, toExcerpt, toPlainText } from './html.ts';

const BASE = 'https://ex.com/posts/1';

test('sanitizeContent removes scripts, handlers and javascript: links', () => {
  const out = sanitizeContent(
    '<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="a.png" onerror="x()">',
    BASE
  );
  assert.doesNotMatch(out, /script|onclick|onerror|javascript:/i);
  assert.match(out, /<p>Hi<\/p>/);
  assert.match(out, /src="https:\/\/ex\.com\/posts\/a\.png"/);
});

test('sanitizeContent demotes h1 and keeps only language-* classes on code', () => {
  const out = sanitizeContent('<h1>T</h1><pre><code class="language-js hljs">x</code></pre>', BASE);
  assert.match(out, /<h2>T<\/h2>/);
  assert.match(out, /<code class="language-js">x<\/code>/);
});

test('sanitizeContent strips tracking pixels, ads and navigation', () => {
  const out = sanitizeContent(
    '<img src="https://medium.com/_/stat?event=x" width="1" height="1"><div class="ad-banner">Buy</div><nav>Menu</nav><header class="post-header"><p>Body</p></header>',
    BASE
  );
  assert.equal(out, '<p>Body</p>');
});

test('sanitizeContent makes links absolute and safe, images lazy', () => {
  const out = sanitizeContent('<a href="/x">x</a><img src="//cdn.ex.com/i.png" alt="A">', BASE);
  assert.match(out, /href="https:\/\/ex\.com\/x"/);
  assert.match(out, /rel="noopener noreferrer"/);
  assert.match(out, /target="_blank"/);
  assert.match(out, /src="https:\/\/cdn\.ex\.com\/i\.png"/);
  assert.match(out, /loading="lazy"/);
});

test('toPlainText separates blocks and decodes entities', () => {
  assert.equal(toPlainText('<p>Hello&nbsp;<b>world</b> &amp; co</p><p>Next</p>'), 'Hello world & co Next');
});

test('toExcerpt truncates on a word boundary', () => {
  const excerpt = toExcerpt(`<p>${'word '.repeat(100)}</p>`, 20);
  assert.ok(excerpt.endsWith('…'));
  assert.ok(excerpt.length <= 21);
  assert.equal(toExcerpt('<p>short</p>'), 'short');
});

test('cleanText decodes entities but keeps literal angle brackets', () => {
  assert.equal(cleanText('Tips &amp; tricks &mdash; CSS&#8217;s   <dialog>'), 'Tips & tricks — CSS’s <dialog>');
});

test('firstImage and httpUrl only return http(s) URLs', () => {
  assert.equal(firstImage('<p>x</p><img src="https://ex.com/a.png?x=1&amp;y=2">'), 'https://ex.com/a.png?x=1&y=2');
  assert.equal(firstImage('<p>none</p>'), null);
  assert.equal(httpUrl('/a', 'https://ex.com/b'), 'https://ex.com/a');
  assert.equal(httpUrl('javascript:alert(1)'), null);
  assert.equal(httpUrl('not a url'), null);
  assert.equal(httpUrl(null), null);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test src/lib/feeds/html.test.ts`
Expected: FAIL. Module not found.

- [ ] **Step 3: Implement**

```ts
import { findAll, getOuterHTML, removeElement } from 'domutils';
import { decodeHTML } from 'entities';
import { parseDocument } from 'htmlparser2';
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'blockquote', 'pre', 'code', 'kbd', 'em', 'strong', 'b', 'i', 'u', 's', 'del', 'ins',
  'mark', 'sub', 'sup', 'a', 'img', 'figure', 'figcaption', 'picture', 'source',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
];
const DROPPED_WITH_CONTENT = [
  'script', 'style', 'textarea', 'option', 'noscript', 'nav', 'aside', 'form',
  'button', 'iframe', 'svg', 'template',
];
const NOISE = /(^|[\s_-])(ad|ads|advert|advertisement|sponsor|sponsored|promo|share|sharing|social|related)([\s_-]|$)/i;
const TRACKER_SRC = /\/_\/stat|pixel|beacon|tracking|feedburner\.com\/~r|\/~ff\//i;
const BLOCK_END = /<\/(p|div|li|h[1-6]|blockquote|pre|tr|figcaption)>|<br\s*\/?>/gi;

export function httpUrl(value: string | null | undefined, base?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim(), base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function resolveAttribute(attribs: sanitizeHtml.Attributes, key: string, base?: string) {
  const { [key]: value, ...rest } = attribs;
  if (!value) return rest;
  try {
    return { ...rest, [key]: new URL(value, base).href };
  } catch {
    return rest;
  }
}

function isTrackingPixel(attribs: sanitizeHtml.Attributes) {
  return attribs.width === '1' || attribs.height === '1' || attribs.width === '0' || TRACKER_SRC.test(attribs.src ?? '');
}

function stripNoise(html: string): string {
  const dom = parseDocument(html);
  findAll(
    ({ attribs }) => NOISE.test(attribs.class ?? '') || NOISE.test(attribs.id ?? ''),
    dom.children
  ).forEach(removeElement);
  return getOuterHTML(dom.children);
}

export function sanitizeContent(html: string, baseUrl?: string): string {
  return sanitizeHtml(stripNoise(html), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'rel', 'target'],
      img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      source: ['srcset', 'type', 'media'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
    },
    allowedClasses: { code: ['language-*'], pre: ['language-*'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    nonTextTags: DROPPED_WITH_CONTENT,
    transformTags: {
      h1: 'h2',
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...resolveAttribute(attribs, 'href', baseUrl), rel: 'noopener noreferrer', target: '_blank' },
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...resolveAttribute(attribs, 'src', baseUrl), loading: 'lazy', decoding: 'async' },
      }),
    },
    exclusiveFilter: ({ tag, attribs }) => tag === 'img' && (!attribs.src || isTrackingPixel(attribs)),
  });
}

export function cleanText(text: string): string {
  return decodeHTML(text).replace(/\s+/g, ' ').trim();
}

export function toPlainText(html: string): string {
  const text = sanitizeHtml(html.replace(BLOCK_END, '$& '), {
    allowedTags: [],
    allowedAttributes: {},
    nonTextTags: DROPPED_WITH_CONTENT,
  });
  return cleanText(text);
}

export function toExcerpt(html: string, max = 280): string {
  const text = toPlainText(html);
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

export function firstImage(html: string): string | null {
  const src = html.match(/<img[^>]*\ssrc="([^"]+)"/i)?.[1];
  return src ? httpUrl(decodeHTML(src)) : null;
}
```

If Prettier reflows the arrays, that's fine. Let `pnpm format` decide the layout.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/feeds/html.test.ts`
Expected: PASS (8 tests). If the `javascript:` test fails because sanitize-html filters schemes *before* `transformTags`, change the `a` transform to drop the attribute when `httpUrl(value, base) === null && !value.startsWith('mailto:')`, then re-run.

- [ ] **Step 5: Commit**

```bash
git add src/lib/feeds/html.ts src/lib/feeds/html.test.ts
git commit -m "Sanitize feed HTML and add text, excerpt and URL helpers"
```

---

### Task 5: Feed parser (RSS 2.0, Atom 1.0, RSS 1.0/RDF, malformed)

**Files:**
- Create: `src/lib/feeds/parse.ts`
- Test: `src/lib/feeds/parse.test.ts`

**Interfaces:**
- Consumes: `parseDate` (Task 2), `cleanText`, `firstImage`, `httpUrl`, `sanitizeContent`, `toExcerpt`, `toPlainText` (Task 4)
- Produces:

```ts
export type FeedFormat = 'rss2' | 'atom' | 'rdf';
export interface ParsedItem {
  guid: string | null; url: string | null; title: string; author: string | null;
  publishedAt: Date | null; excerpt: string; contentHtml: string | null; imageUrl: string | null;
}
export interface ParsedFeed {
  format: FeedFormat; title: string | null; siteUrl: string | null; description: string | null;
  iconUrl: string | null; items: ParsedItem[];
}
export class FeedParseError extends Error {}
export function parseFeed(xml: string, feedUrl?: string): ParsedFeed;
```

`contentHtml` is non-null only for full content: an explicit `content:encoded` or Atom `<content>`, or a description ≥ 500 plain-text chars. Phase 3's reader view relies on this.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FeedParseError, parseFeed } from './parse.ts';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>CSS &amp;amp; Tricks</title>
  <link>https://example.com/</link>
  <description>Tips &amp; tricks</description>
  <image><url>https://example.com/icon.png</url></image>
  <item>
    <title>Grid&#8217;s new &amp;mdash; tricks</title>
    <link>/posts/grid</link>
    <guid isPermaLink="false">post-1</guid>
    <dc:creator>Ana</dc:creator>
    <pubDate>Mon, 15 Jan 2024 10:30:00 GMT</pubDate>
    <description>&lt;p&gt;Short summary&lt;/p&gt;</description>
    <content:encoded><![CDATA[<p>Full <strong>body</strong></p><img src="/img/hero.png" alt="Hero"><script>alert(1)</script>]]></content:encoded>
  </item>
  <item><title>Only a title</title></item>
  <item>
    <description>No title here but there is text</description>
    <guid>https://example.com/posts/3</guid>
  </item>
  <item>
    <title>With enclosure</title>
    <link>javascript:alert(1)</link>
    <enclosure url="https://cdn.example.com/a.jpg" type="image/jpeg" length="1"/>
  </item>
</channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="html">Simon &lt;em&gt;Willison&lt;/em&gt;</title>
  <subtitle>Notes</subtitle>
  <link href="https://simon.example/atom/" rel="self"/>
  <link href="https://simon.example/" rel="alternate"/>
  <icon>/favicon.ico</icon>
  <entry>
    <title>The &lt;dialog&gt; element</title>
    <link href="https://simon.example/2024/dialog/" rel="alternate"/>
    <id>tag:simon.example,2024:1</id>
    <updated>2024-01-16T00:00:00Z</updated>
    <published>2024-01-15T10:30:00+02:00</published>
    <author><name>Simon</name></author>
    <summary type="html">&lt;p&gt;A summary&lt;/p&gt;</summary>
    <content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Full <code>dialog</code> post</p></div></content>
  </entry>
  <entry>
    <title>Updated only</title>
    <id>tag:2</id>
    <updated>2024-02-01T00:00:00Z</updated>
    <content type="html">&lt;p&gt;Body &lt;a href="javascript:alert(1)"&gt;x&lt;/a&gt;&lt;/p&gt;</content>
  </entry>
</feed>`;

const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://rdf.example/">
    <title>RDF Site</title><link>https://rdf.example/</link><description>Old school</description>
  </channel>
  <item rdf:about="https://rdf.example/1">
    <title>First RDF</title><link>https://rdf.example/1</link>
    <dc:date>2024-01-15T10:30:00Z</dc:date><description>Hello</description>
  </item>
</rdf:RDF>`;

test('parses RSS 2.0 channel metadata', () => {
  const feed = parseFeed(RSS);
  assert.equal(feed.format, 'rss2');
  assert.equal(feed.title, 'CSS & Tricks');
  assert.equal(feed.siteUrl, 'https://example.com/');
  assert.equal(feed.description, 'Tips & tricks');
  assert.equal(feed.iconUrl, 'https://example.com/icon.png');
  assert.equal(feed.items.length, 4);
});

test('parses a full RSS 2.0 item', () => {
  const [item] = parseFeed(RSS).items;
  assert.equal(item.title, 'Grid’s new — tricks');
  assert.equal(item.url, 'https://example.com/posts/grid');
  assert.equal(item.guid, 'post-1');
  assert.equal(item.author, 'Ana');
  assert.equal(item.publishedAt?.toISOString(), '2024-01-15T10:30:00.000Z');
  assert.equal(item.excerpt, 'Short summary');
  assert.match(item.contentHtml ?? '', /<strong>body<\/strong>/);
  assert.doesNotMatch(item.contentHtml ?? '', /script/);
  assert.equal(item.imageUrl, 'https://example.com/img/hero.png');
});

test('handles RSS items with missing optional fields', () => {
  const [, onlyTitle, noTitle, enclosure] = parseFeed(RSS).items;
  assert.deepEqual(onlyTitle, {
    guid: null, url: null, title: 'Only a title', author: null,
    publishedAt: null, excerpt: '', contentHtml: null, imageUrl: null,
  });
  assert.equal(noTitle.title, 'No title here but there is text');
  assert.equal(noTitle.url, 'https://example.com/posts/3');
  assert.equal(noTitle.contentHtml, null);
  assert.equal(enclosure.url, null);
  assert.equal(enclosure.imageUrl, 'https://cdn.example.com/a.jpg');
});

test('parses Atom 1.0', () => {
  const feed = parseFeed(ATOM);
  assert.equal(feed.format, 'atom');
  assert.equal(feed.title, 'Simon Willison');
  assert.equal(feed.siteUrl, 'https://simon.example/');
  assert.equal(feed.description, 'Notes');
  assert.equal(feed.iconUrl, 'https://simon.example/favicon.ico');

  const [entry, updatedOnly] = feed.items;
  assert.equal(entry.title, 'The <dialog> element');
  assert.equal(entry.url, 'https://simon.example/2024/dialog/');
  assert.equal(entry.guid, 'tag:simon.example,2024:1');
  assert.equal(entry.author, 'Simon');
  assert.equal(entry.publishedAt?.toISOString(), '2024-01-15T08:30:00.000Z');
  assert.equal(entry.excerpt, 'A summary');
  assert.match(entry.contentHtml ?? '', /<code>dialog<\/code>/);

  assert.equal(updatedOnly.publishedAt?.toISOString(), '2024-02-01T00:00:00.000Z');
  assert.doesNotMatch(updatedOnly.contentHtml ?? '', /javascript:/);
});

test('parses RSS 1.0 / RDF', () => {
  const feed = parseFeed(RDF);
  assert.equal(feed.format, 'rdf');
  assert.equal(feed.title, 'RDF Site');
  assert.equal(feed.items[0].guid, 'https://rdf.example/1');
  assert.equal(feed.items[0].url, 'https://rdf.example/1');
  assert.equal(feed.items[0].publishedAt?.toISOString(), '2024-01-15T10:30:00.000Z');
});

test('partially parses truncated XML with bare ampersands', () => {
  const feed = parseFeed(
    '<rss><channel><title>Tom & Jerry</title><item><title>First</title><link>https://x.example/1</link></item><item><title>Sec'
  );
  assert.equal(feed.title, 'Tom & Jerry');
  assert.equal(feed.items[0].title, 'First');
});

test('accepts a valid feed with no items', () => {
  assert.deepEqual(parseFeed('<rss><channel><title>Quiet</title></channel></rss>').items, []);
});

test('rejects web pages and non-feeds with clear messages', () => {
  assert.throws(
    () => parseFeed('<!doctype html><html><head><title>Hi</title></head><body></body></html>'),
    (error) => error instanceof FeedParseError && /web page, not a feed/.test(error.message)
  );
  assert.throws(() => parseFeed('not xml at all'), /RSS or Atom/);
  assert.throws(() => parseFeed('{"version":"https://jsonfeed.org/version/1"}'), /RSS or Atom/);
  assert.throws(() => parseFeed(''), FeedParseError);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test src/lib/feeds/parse.test.ts`
Expected: FAIL. Module not found.

- [ ] **Step 3: Implement**

```ts
import type { Element } from 'domhandler';
import { getElementsByTagName, getInnerHTML, isTag, textContent } from 'domutils';
import { escapeUTF8 } from 'entities';
import { parseDocument } from 'htmlparser2';
import { parseDate } from './dates.ts';
import { cleanText, firstImage, httpUrl, sanitizeContent, toExcerpt, toPlainText } from './html.ts';

const FULL_CONTENT_MIN_CHARS = 500;
const TITLE_FROM_EXCERPT_CHARS = 80;

export type FeedFormat = 'rss2' | 'atom' | 'rdf';

export interface ParsedItem {
  guid: string | null;
  url: string | null;
  title: string;
  author: string | null;
  publishedAt: Date | null;
  excerpt: string;
  contentHtml: string | null;
  imageUrl: string | null;
}

export interface ParsedFeed {
  format: FeedFormat;
  title: string | null;
  siteUrl: string | null;
  description: string | null;
  iconUrl: string | null;
  items: ParsedItem[];
}

export class FeedParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedParseError';
  }
}

interface ItemFields {
  guid: string | null;
  url: string | null;
  title: string;
  author: string | null;
  date: string | null;
  contentHtml: string | null;
  summaryHtml: string | null;
  hasExplicitContent: boolean;
  node: Element;
}

const elementChildren = (parent: Element, name: string) =>
  parent.children.filter((node): node is Element => isTag(node) && node.name === name);

const firstChild = (parent: Element | undefined, name: string) =>
  parent ? elementChildren(parent, name)[0] : undefined;

const textOf = (parent: Element | undefined, ...names: string[]) =>
  names.map((name) => {
    const node = firstChild(parent, name);
    return node ? textContent(node).trim() : '';
  }).find(Boolean) ?? null;

const isPresent = <T>(value: T | null): value is T => value !== null;

function mediaImage(node: Element): string | null {
  const thumbnail = getElementsByTagName('media:thumbnail', node, true, 1)[0]?.attribs.url;
  const media = getElementsByTagName('media:content', node).find(
    ({ attribs }) => attribs.medium === 'image' || attribs.type?.startsWith('image/')
  )?.attribs.url;
  const enclosure = elementChildren(node, 'enclosure').find(({ attribs }) =>
    attribs.type?.startsWith('image/')
  )?.attribs.url;
  return thumbnail ?? media ?? enclosure ?? null;
}

function buildItem(fields: ItemFields): ParsedItem | null {
  const base = fields.url ?? undefined;
  const content = fields.contentHtml ? sanitizeContent(fields.contentHtml, base) : '';
  const excerpt = toExcerpt(fields.summaryHtml ?? content);
  const title = fields.title || excerpt.slice(0, TITLE_FROM_EXCERPT_CHARS) || fields.url;
  if (!title) return null;

  const isFullContent =
    fields.hasExplicitContent || toPlainText(content).length >= FULL_CONTENT_MIN_CHARS;
  return {
    guid: fields.guid,
    url: fields.url,
    title,
    author: fields.author,
    publishedAt: parseDate(fields.date),
    excerpt,
    contentHtml: content && isFullContent ? content : null,
    imageUrl: httpUrl(mediaImage(fields.node), base) ?? firstImage(content),
  };
}

function rssItem(node: Element, base: string | undefined): ParsedItem | null {
  const guidNode = firstChild(node, 'guid');
  const guid = (guidNode && textContent(guidNode).trim()) || node.attribs['rdf:about'] || null;
  const guidLink =
    guid && guidNode?.attribs.ispermalink !== 'false' && /^https?:\/\//i.test(guid) ? guid : null;
  const encoded = textOf(node, 'content:encoded');
  const description = textOf(node, 'description');
  return buildItem({
    guid,
    url: httpUrl(textOf(node, 'link') ?? guidLink, base),
    title: cleanText(textOf(node, 'title') ?? ''),
    author: textOf(node, 'dc:creator', 'author'),
    date: textOf(node, 'pubdate', 'dc:date'),
    contentHtml: encoded ?? description,
    summaryHtml: encoded ? description : null,
    hasExplicitContent: Boolean(encoded),
    node,
  });
}

function parseRss(root: Element, format: 'rss2' | 'rdf', feedUrl?: string): ParsedFeed {
  const channel = firstChild(root, 'channel');
  const siteUrl = httpUrl(textOf(channel, 'link'), feedUrl);
  const base = siteUrl ?? feedUrl;
  const image = firstChild(root, 'image') ?? firstChild(channel, 'image');
  return {
    format,
    title: cleanText(textOf(channel, 'title') ?? '') || null,
    siteUrl,
    description: toPlainText(textOf(channel, 'description') ?? '') || null,
    iconUrl: httpUrl(textOf(image, 'url'), base),
    items: elementChildren(format === 'rdf' ? root : (channel ?? root), 'item')
      .map((node) => rssItem(node, base))
      .filter(isPresent),
  };
}

function atomHtml(node: Element | undefined): string | null {
  if (!node || node.attribs.src) return null;
  if (node.attribs.type === 'xhtml') return getInnerHTML(node).trim() || null;
  const value = textContent(node).trim();
  if (!value) return null;
  return node.attribs.type === 'html' || node.attribs.type === 'text/html' ? value : escapeUTF8(value);
}

const atomText = (node: Element | undefined) => {
  const html = atomHtml(node);
  return html ? toPlainText(html) || null : null;
};

const atomLink = (node: Element) =>
  elementChildren(node, 'link').find(({ attribs }) => !attribs.rel || attribs.rel === 'alternate')
    ?.attribs.href ?? null;

function atomEntry(node: Element, base: string | undefined): ParsedItem | null {
  const content = atomHtml(firstChild(node, 'content'));
  const summary = atomHtml(firstChild(node, 'summary'));
  return buildItem({
    guid: textOf(node, 'id'),
    url: httpUrl(atomLink(node), base),
    title: atomText(firstChild(node, 'title')) ?? '',
    author: textOf(firstChild(node, 'author'), 'name'),
    date: textOf(node, 'published', 'updated'),
    contentHtml: content ?? summary,
    summaryHtml: content ? summary : null,
    hasExplicitContent: Boolean(content),
    node,
  });
}

function parseAtom(root: Element, feedUrl?: string): ParsedFeed {
  const siteUrl = httpUrl(atomLink(root), feedUrl);
  const base = siteUrl ?? feedUrl;
  return {
    format: 'atom',
    title: atomText(firstChild(root, 'title')),
    siteUrl,
    description: atomText(firstChild(root, 'subtitle')),
    iconUrl: httpUrl(textOf(root, 'icon', 'logo'), base),
    items: elementChildren(root, 'entry')
      .map((node) => atomEntry(node, base))
      .filter(isPresent),
  };
}

export function parseFeed(xml: string, feedUrl?: string): ParsedFeed {
  const dom = parseDocument(xml, {
    xmlMode: true,
    lowerCaseTags: true,
    lowerCaseAttributeNames: true,
  });
  const root = dom.children.find(isTag);
  if (root?.name === 'rss') return parseRss(root, 'rss2', feedUrl);
  if (root?.name === 'rdf:rdf') return parseRss(root, 'rdf', feedUrl);
  if (root?.name === 'feed') return parseAtom(root, feedUrl);
  if (root?.name === 'html') throw new FeedParseError('This address returned a web page, not a feed');
  throw new FeedParseError("This doesn't look like an RSS or Atom feed");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/feeds/parse.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Smoke-test against two real feeds**

```bash
node -e "
import('./src/lib/feeds/parse.ts').then(async ({ parseFeed }) => {
  for (const url of ['https://simonwillison.net/atom/everything/', 'https://hnrss.org/best']) {
    const feed = parseFeed(await (await fetch(url)).text(), url);
    console.log(feed.format, feed.title, feed.items.length, feed.items[0]?.title, feed.items[0]?.publishedAt);
  }
});"
```

Expected: `atom Simon Willison's Weblog <n> <title> <date>` and `rss2 Hacker News: Best <n> <title> <date>`, with no `null` dates.

- [ ] **Step 6: Commit**

```bash
git add src/lib/feeds/parse.ts src/lib/feeds/parse.test.ts
git commit -m "Parse RSS 2.0, Atom 1.0 and RDF feeds with partial-parse tolerance"
```

---

### Task 6: Fetcher with SSRF guard, timeout, redirects and conditional GET

**Files:**
- Create: `src/lib/feeds/fetch.ts`
- Test: `src/lib/feeds/fetch.test.ts`

**Interfaces:**
- Consumes: `decodeFeed` (Task 3)
- Produces:

```ts
export type FeedErrorKind = 'invalid-url' | 'blocked-host' | 'dns' | 'timeout' | 'network'
  | 'http' | 'too-large' | 'redirect-loop' | 'not-a-feed';
export interface FeedError { kind: FeedErrorKind; message: string; status: number | null; permanent: boolean }
export type FetchResult =
  | { kind: 'ok'; body: string; finalUrl: string; movedPermanently: boolean; etag: string | null; lastModified: string | null }
  | { kind: 'not-modified'; finalUrl: string; movedPermanently: boolean }
  | { kind: 'error'; error: FeedError };
export interface FetchOptions { etag?: string | null; lastModified?: string | null; timeoutMs?: number; allowPrivateHosts?: boolean }
export function isPrivateAddress(ip: string): boolean;
export function fetchFeed(url: string, options?: FetchOptions): Promise<FetchResult>;
```

`'not-a-feed'` is never produced here. Task 9 uses it when `parseFeed` throws. `allowPrivateHosts` exists only so tests can hit a local server.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { fetchFeed, isPrivateAddress } from './fetch.ts';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
const RSS = '<rss><channel><title>T</title></channel></rss>';
const redirect = (status: number, to: string): Handler => (_req, res) => {
  res.writeHead(status, { Location: to });
  res.end();
};

const routes: Record<string, Handler> = {
  '/feed': (req, res) => {
    if (req.headers['if-none-match'] === '"v1"') {
      res.writeHead(304);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8', ETag: '"v1"' });
    res.end(RSS);
  },
  '/moved': redirect(301, '/moved-again'),
  '/moved-again': redirect(308, '/feed'),
  '/temporary': redirect(302, '/feed'),
  '/loop': redirect(302, '/loop'),
  '/gone': (_req, res) => { res.writeHead(404); res.end(); },
  '/down': (_req, res) => { res.writeHead(503); res.end(); },
  '/slow': () => {},
  '/huge': (_req, res) => {
    res.writeHead(200);
    res.end(Buffer.alloc(5 * 1024 * 1024 + 1, 'a'));
  },
};

const server = createServer((req, res) => {
  const handler = routes[req.url ?? ''];
  if (handler) handler(req, res);
  else {
    res.writeHead(404);
    res.end();
  }
});
let origin = '';
const local = { allowPrivateHosts: true };

before(async () => {
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.closeAllConnections();
  server.close();
});

test('isPrivateAddress covers loopback, private, link-local and mapped ranges', () => {
  ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1']
    .forEach((ip) => assert.equal(isPrivateAddress(ip), true, ip));
  ['8.8.8.8', '104.16.0.1', '2606:4700::1']
    .forEach((ip) => assert.equal(isPrivateAddress(ip), false, ip));
});

test('fetches a feed and returns caching headers', async () => {
  const result = await fetchFeed(`${origin}/feed`, local);
  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  assert.equal(result.body, RSS);
  assert.equal(result.etag, '"v1"');
  assert.equal(result.movedPermanently, false);
});

test('sends conditional headers and reports not-modified', async () => {
  const result = await fetchFeed(`${origin}/feed`, { ...local, etag: '"v1"' });
  assert.equal(result.kind, 'not-modified');
});

test('follows redirects and only flags all-permanent chains as moved', async () => {
  const moved = await fetchFeed(`${origin}/moved`, local);
  assert.equal(moved.kind, 'ok');
  if (moved.kind === 'ok') {
    assert.equal(moved.finalUrl, `${origin}/feed`);
    assert.equal(moved.movedPermanently, true);
  }
  const temporary = await fetchFeed(`${origin}/temporary`, local);
  assert.equal(temporary.kind === 'ok' && temporary.movedPermanently, false);
});

test('classifies failures', async () => {
  const cases: [string, string, boolean][] = [
    ['/loop', 'redirect-loop', false],
    ['/gone', 'http', true],
    ['/down', 'http', false],
    ['/huge', 'too-large', false],
  ];
  await Promise.all(cases.map(async ([path, kind, permanent]) => {
    const result = await fetchFeed(`${origin}${path}`, local);
    assert.equal(result.kind, 'error', path);
    if (result.kind !== 'error') return;
    assert.equal(result.error.kind, kind, path);
    assert.equal(result.error.permanent, permanent, path);
  }));
});

test('times out slow servers', async () => {
  const started = Date.now();
  const result = await fetchFeed(`${origin}/slow`, { ...local, timeoutMs: 200 });
  assert.equal(result.kind === 'error' && result.error.kind, 'timeout');
  assert.ok(Date.now() - started < 2000);
});

test('blocks private hosts and bad URLs by default', async () => {
  const blocked = await fetchFeed(`${origin}/feed`);
  assert.equal(blocked.kind === 'error' && blocked.error.kind, 'blocked-host');
  const invalid = await fetchFeed('not a url');
  assert.equal(invalid.kind === 'error' && invalid.error.kind, 'invalid-url');
  const ftp = await fetchFeed('ftp://example.com/feed');
  assert.equal(ftp.kind === 'error' && ftp.error.kind, 'invalid-url');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test src/lib/feeds/fetch.test.ts`
Expected: FAIL. Module not found.

- [ ] **Step 3: Implement**

```ts
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { decodeFeed } from './decode.ts';

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const PERMANENT_REDIRECTS = new Set([301, 308]);
const USER_AGENT = 'FrontpageReader/1.0 (RSS reader)';
const ACCEPT = 'application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5';

const PRIVATE_V4: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
];
const PRIVATE_V6: [string, number][] = [['::', 127], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]];
const privateRanges = new BlockList();
PRIVATE_V4.forEach(([network, prefix]) => privateRanges.addSubnet(network, prefix, 'ipv4'));
PRIVATE_V6.forEach(([network, prefix]) => privateRanges.addSubnet(network, prefix, 'ipv6'));

export type FeedErrorKind =
  | 'invalid-url' | 'blocked-host' | 'dns' | 'timeout' | 'network'
  | 'http' | 'too-large' | 'redirect-loop' | 'not-a-feed';

export interface FeedError {
  kind: FeedErrorKind;
  message: string;
  status: number | null;
  permanent: boolean;
}

export type FetchResult =
  | { kind: 'ok'; body: string; finalUrl: string; movedPermanently: boolean; etag: string | null; lastModified: string | null }
  | { kind: 'not-modified'; finalUrl: string; movedPermanently: boolean }
  | { kind: 'error'; error: FeedError };

export interface FetchOptions {
  etag?: string | null;
  lastModified?: string | null;
  timeoutMs?: number;
  allowPrivateHosts?: boolean;
}

class FetchFailure extends Error {
  readonly feedError: FeedError;

  constructor(feedError: FeedError) {
    super(feedError.message);
    this.feedError = feedError;
  }
}

const failure = (kind: FeedErrorKind, message: string, permanent = false, status: number | null = null) =>
  new FetchFailure({ kind, message, permanent, status });

export function isPrivateAddress(ip: string): boolean {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return isPrivateAddress(mapped);
  return privateRanges.check(ip, isIP(ip) === 6 ? 'ipv6' : 'ipv4');
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true }).catch(() => {
        throw failure('dns', `We couldn't find the server ${host}`);
      })).map(({ address }) => address);
  // ponytail: checked before connecting, so DNS rebinding between lookup and fetch is still possible; pin resolved IPs via an undici dispatcher if this app ever runs inside a private network.
  if (addresses.some(isPrivateAddress)) {
    throw failure('blocked-host', 'Feeds on private or local network addresses are not allowed', true);
  }
}

function httpFailure(status: number): FetchFailure {
  if (status === 404) return failure('http', 'The feed returned 404 Not Found. It may have moved or been removed', true, status);
  if (status === 410) return failure('http', 'The feed has been permanently removed (410 Gone)', true, status);
  if (status === 429) return failure('http', "The feed's server is rate limiting requests (429). We'll retry later", false, status);
  if (status >= 500) return failure('http', `The feed's server had an error (${status}). We'll retry later`, false, status);
  return failure('http', `The feed's server refused the request (${status})`, false, status);
}

async function readLimited(response: Response): Promise<Uint8Array> {
  const tooLarge = failure('too-large', 'The feed is larger than 5 MB');
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw tooLarge;
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let size = 0;
  const pump = async (): Promise<void> => {
    const { done, value } = await reader.read();
    if (done) return;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw tooLarge;
    }
    chunks.push(value);
    await pump();
  };
  await pump();
  return Buffer.concat(chunks);
}

function toFeedError(error: unknown): FeedError {
  if (error instanceof FetchFailure) return error.feedError;
  if (error instanceof Error && error.name === 'TimeoutError') {
    return { kind: 'timeout', message: 'The feed took longer than 10 seconds to respond', status: null, permanent: false };
  }
  return { kind: 'network', message: "We couldn't connect to the feed's server", status: null, permanent: false };
}

function parseUrl(raw: string, base?: URL): URL {
  let url: URL;
  try {
    url = new URL(raw.trim(), base);
  } catch {
    throw failure('invalid-url', "That doesn't look like a valid web address", true);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw failure('invalid-url', 'Only http and https feed addresses are supported', true);
  }
  return url;
}

export async function fetchFeed(rawUrl: string, options: FetchOptions = {}): Promise<FetchResult> {
  const signal = AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS);
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: ACCEPT };
  if (options.etag) headers['If-None-Match'] = options.etag;
  if (options.lastModified) headers['If-Modified-Since'] = options.lastModified;

  const request = async (url: URL, hop: number, allPermanent: boolean): Promise<FetchResult> => {
    if (hop > MAX_REDIRECTS) throw failure('redirect-loop', 'The feed redirects too many times');
    if (!options.allowPrivateHosts) await assertPublicHost(url);
    const response = await fetch(url, { redirect: 'manual', signal, headers });

    if (REDIRECT_STATUSES.has(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (!location) throw httpFailure(response.status);
      return request(parseUrl(location, url), hop + 1, allPermanent && PERMANENT_REDIRECTS.has(response.status));
    }

    const finalUrl = url.href;
    const movedPermanently = hop > 0 && allPermanent;
    if (response.status === 304) {
      await response.body?.cancel();
      return { kind: 'not-modified', finalUrl, movedPermanently };
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw httpFailure(response.status);
    }
    const bytes = await readLimited(response);
    return {
      kind: 'ok',
      body: decodeFeed(bytes, response.headers.get('content-type')),
      finalUrl,
      movedPermanently,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    };
  };

  try {
    return await request(parseUrl(rawUrl), 0, true);
  } catch (error) {
    return { kind: 'error', error: toFeedError(error) };
  }
}
```

`['::', 127]` covers both `::` and `::1`. `['224.0.0.0', 3]` covers multicast plus reserved `240/4`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/feeds/fetch.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/feeds/fetch.ts src/lib/feeds/fetch.test.ts
git commit -m "Fetch feeds with SSRF guard, timeout, size cap, redirects and conditional GET"
```

---

### Task 7: Feed health and backoff

**Files:**
- Create: `src/lib/feeds/health.ts`
- Test: `src/lib/feeds/health.test.ts`

**Interfaces:**
- Produces:

```ts
export type FeedHealth = 'pending' | 'active' | 'stale' | 'error' | 'dead';
export interface FeedHealthInput { lastSuccessAt: Date | null; latestItemAt: Date | null; failCount: number; errorPermanent: boolean }
export const REFRESH_INTERVAL_MS: number; // 15 min
export function feedHealth(feed: FeedHealthInput, now: Date): FeedHealth;
export function nextFetchAt(failCount: number, now: Date): Date;
```

Prisma's `Feed` model (Task 8) is structurally assignable to `FeedHealthInput`.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { feedHealth, nextFetchAt } from './health.ts';

const now = new Date('2026-10-08T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
const healthy = { lastSuccessAt: now, latestItemAt: daysAgo(1), failCount: 0, errorPermanent: false };

test('feedHealth', () => {
  assert.equal(feedHealth(healthy, now), 'active');
  assert.equal(feedHealth({ ...healthy, lastSuccessAt: null, latestItemAt: null }, now), 'pending');
  assert.equal(feedHealth({ ...healthy, latestItemAt: daysAgo(31) }, now), 'stale');
  assert.equal(feedHealth({ ...healthy, latestItemAt: null }, now), 'stale');
  assert.equal(feedHealth({ ...healthy, failCount: 1 }, now), 'error');
  assert.equal(feedHealth({ ...healthy, failCount: 2, errorPermanent: true }, now), 'error');
  assert.equal(feedHealth({ ...healthy, failCount: 3, errorPermanent: true }, now), 'dead');
  assert.equal(feedHealth({ ...healthy, failCount: 10 }, now), 'dead');
});

test('nextFetchAt backs off exponentially and caps at 24 hours', () => {
  const minutes = (failCount: number) => (nextFetchAt(failCount, now).getTime() - now.getTime()) / 60_000;
  assert.equal(minutes(0), 15);
  assert.equal(minutes(1), 15);
  assert.equal(minutes(2), 30);
  assert.equal(minutes(3), 60);
  assert.equal(minutes(10), 24 * 60);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test src/lib/feeds/health.test.ts`
Expected: FAIL. Module not found.

- [ ] **Step 3: Implement**

```ts
export type FeedHealth = 'pending' | 'active' | 'stale' | 'error' | 'dead';

export interface FeedHealthInput {
  lastSuccessAt: Date | null;
  latestItemAt: Date | null;
  failCount: number;
  errorPermanent: boolean;
}

export const REFRESH_INTERVAL_MS = 15 * 60_000;
const STALE_AFTER_MS = 30 * 86_400_000;
const MAX_BACKOFF_MS = 24 * 3_600_000;
const DEAD_AFTER_FAILURES = 10;
const DEAD_AFTER_PERMANENT_FAILURES = 3;

export function feedHealth(feed: FeedHealthInput, now: Date): FeedHealth {
  const isDead =
    feed.failCount >= DEAD_AFTER_FAILURES ||
    (feed.errorPermanent && feed.failCount >= DEAD_AFTER_PERMANENT_FAILURES);
  if (isDead) return 'dead';
  if (feed.failCount > 0) return 'error';
  if (!feed.lastSuccessAt) return 'pending';
  if (!feed.latestItemAt || now.getTime() - feed.latestItemAt.getTime() > STALE_AFTER_MS) return 'stale';
  return 'active';
}

export function nextFetchAt(failCount: number, now: Date): Date {
  const delay =
    failCount === 0
      ? REFRESH_INTERVAL_MS
      : Math.min(REFRESH_INTERVAL_MS * 2 ** (failCount - 1), MAX_BACKOFF_MS);
  return new Date(now.getTime() + delay);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/feeds/health.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/feeds/health.ts src/lib/feeds/health.test.ts
git commit -m "Add feed health classification and exponential backoff"
```

---

### Task 8: Database schema, env and Prisma client

**Files:**
- Create: `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/env.ts`, `src/lib/db.ts`, `.env.example`, `.env` (untracked)

**Interfaces:**
- Produces: `import prisma from '@/lib/db'` (a `PrismaClient`), `import env from '@/lib/env'` (`{ NODE_ENV, DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL }`), and models `User`, `Session`, `Account`, `Verification`, `Feed`, `Item`, `Category`, `Subscription` with the fields below.

- [ ] **Step 1: Create the local database and `.env`**

```bash
/Applications/Postgres.app/Contents/Versions/latest/bin/createdb frontpage
cat > .env <<EOF
DATABASE_URL="postgresql://$(whoami)@localhost:5432/frontpage"
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
BETTER_AUTH_URL="http://localhost:3000"
EOF
cat > .env.example <<'EOF'
DATABASE_URL="postgresql://USER@localhost:5432/frontpage"
BETTER_AUTH_SECRET="generate with: openssl rand -base64 32"
BETTER_AUTH_URL="http://localhost:3000"
EOF
```

- [ ] **Step 2: Write `prisma.config.ts`** (identical to todo-app)

```ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
```

- [ ] **Step 3: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model User {
  id            String         @id
  name          String
  email         String         @unique
  emailVerified Boolean        @default(false)
  image         String?
  isAnonymous   Boolean?       @default(false)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  sessions      Session[]
  accounts      Account[]
  categories    Category[]
  subscriptions Subscription[]

  @@map("user")
}

model Session {
  id        String   @id
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@map("verification")
}

model Feed {
  id              String         @id @default(uuid())
  url             String         @unique
  title           String
  siteUrl         String?
  description     String?
  iconUrl         String?
  etag            String?
  lastModified    String?
  lastFetchedAt   DateTime?
  lastSuccessAt   DateTime?
  latestItemAt    DateTime?
  failCount       Int            @default(0)
  lastError       String?
  lastErrorStatus Int?
  errorPermanent  Boolean        @default(false)
  nextFetchAt     DateTime       @default(now())
  createdAt       DateTime       @default(now())
  items           Item[]
  subscriptions   Subscription[]

  @@index([nextFetchAt])
}

model Item {
  id          String   @id @default(uuid())
  feedId      String
  feed        Feed     @relation(fields: [feedId], references: [id], onDelete: Cascade)
  guid        String
  url         String?
  title       String
  author      String?
  excerpt     String
  contentHtml String?
  imageUrl    String?
  publishedAt DateTime
  createdAt   DateTime @default(now())

  @@unique([feedId, guid])
  @@index([feedId, publishedAt(sort: Desc)])
}

model Category {
  id            String         @id @default(uuid())
  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String
  position      Int
  subscriptions Subscription[]

  @@unique([userId, name])
  @@index([userId, position])
}

model Subscription {
  id         String    @id @default(uuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  feedId     String
  feed       Feed      @relation(fields: [feedId], references: [id], onDelete: Cascade)
  categoryId String?
  category   Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  title      String?
  createdAt  DateTime  @default(now())

  @@unique([userId, feedId])
  @@index([userId, categoryId])
}
```

- [ ] **Step 4: Write `src/lib/env.ts` and `src/lib/db.ts`**

```ts
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
}

export default parsed.data;
```

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import env from '@/lib/env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
```

- [ ] **Step 5: Migrate and verify**

Run: `pnpm db:migrate --name init`
Expected: `Your database is now in sync with your schema` and a client generated into `src/generated/prisma`.

Run: `psql frontpage -c '\dt'`
Expected: tables `Category`, `Feed`, `Item`, `Subscription`, `_prisma_migrations`, `account`, `session`, `user`, `verification`.

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma prisma.config.ts src/lib/env.ts src/lib/db.ts .env.example
git commit -m "Add Prisma schema for auth, feeds, items, categories and subscriptions"
```

---

### Task 9: Ingest mapping and refresh service

**Files:**
- Create: `src/lib/feeds/ingest.ts`, `src/lib/refresh.ts`
- Test: `src/lib/feeds/ingest.test.ts`

**Interfaces:**
- Consumes: `ParsedItem`, `parseFeed`, `FeedParseError` (Task 5), `fetchFeed`, `FeedError` (Task 6), `nextFetchAt` (Task 7), `prisma` (Task 8)
- Produces:

```ts
// ingest.ts (pure)
export interface ItemRow { feedId: string; guid: string; url: string | null; title: string; author: string | null;
  excerpt: string; contentHtml: string | null; imageUrl: string | null; publishedAt: Date }
export const MAX_ITEMS_PER_FETCH = 200;
export function toItemRows(feedId: string, items: ParsedItem[], fetchedAt: Date): ItemRow[];
export function latestPublished(rows: ItemRow[]): Date | null;
// src/lib/refresh.ts (server-only; lives outside feeds/ because it uses the @/ alias)
export function refreshFeed(feedId: string, options?: { force?: boolean }): Promise<void>;
export function refreshFeeds(feedIds: string[], options?: { force?: boolean }): Promise<void>;
```

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { latestPublished, MAX_ITEMS_PER_FETCH, toItemRows } from './ingest.ts';
import type { ParsedItem } from './parse.ts';

const fetchedAt = new Date('2026-10-08T12:00:00Z');
const item = (overrides: Partial<ParsedItem>): ParsedItem => ({
  guid: null, url: null, title: 'T', author: null, publishedAt: null,
  excerpt: '', contentHtml: null, imageUrl: null, ...overrides,
});

test('guid falls back to url, then a stable hash of title and date', () => {
  const [byGuid, byUrl, byHash, sameHash] = toItemRows('f', [
    item({ guid: 'g', url: 'https://x/1' }),
    item({ url: 'https://x/2' }),
    item({ title: 'Hello' }),
    item({ title: 'Hello' }),
  ], fetchedAt);
  assert.equal(byGuid.guid, 'g');
  assert.equal(byUrl.guid, 'https://x/2');
  assert.match(byHash.guid, /^[0-9a-f]{40}$/);
  assert.equal(byHash.guid, sameHash.guid);
});

test('missing and future dates become the fetch time', () => {
  const [missing, future, past] = toItemRows('f', [
    item({}),
    item({ publishedAt: new Date('2030-01-01T00:00:00Z') }),
    item({ publishedAt: new Date('2024-01-01T00:00:00Z') }),
  ], fetchedAt);
  assert.equal(missing.publishedAt, fetchedAt);
  assert.equal(future.publishedAt, fetchedAt);
  assert.equal(past.publishedAt.toISOString(), '2024-01-01T00:00:00.000Z');
});

test('caps rows per fetch and finds the latest date', () => {
  const rows = toItemRows('f', Array.from({ length: 250 }, (_, i) => item({ guid: String(i) })), fetchedAt);
  assert.equal(rows.length, MAX_ITEMS_PER_FETCH);
  assert.equal(latestPublished(rows), fetchedAt);
  assert.equal(latestPublished([]), null);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test src/lib/feeds/ingest.test.ts`
Expected: FAIL. Module not found.

- [ ] **Step 3: Implement `src/lib/feeds/ingest.ts`**

```ts
import { createHash } from 'node:crypto';
import type { ParsedItem } from './parse.ts';

export const MAX_ITEMS_PER_FETCH = 200;

export interface ItemRow {
  feedId: string;
  guid: string;
  url: string | null;
  title: string;
  author: string | null;
  excerpt: string;
  contentHtml: string | null;
  imageUrl: string | null;
  publishedAt: Date;
}

const fallbackGuid = ({ title, publishedAt }: ParsedItem) =>
  createHash('sha1').update(`${title}\n${publishedAt?.toISOString() ?? ''}`).digest('hex');

export function toItemRows(feedId: string, items: ParsedItem[], fetchedAt: Date): ItemRow[] {
  return items.slice(0, MAX_ITEMS_PER_FETCH).map((item) => ({
    feedId,
    guid: item.guid ?? item.url ?? fallbackGuid(item),
    url: item.url,
    title: item.title,
    author: item.author,
    excerpt: item.excerpt,
    contentHtml: item.contentHtml,
    imageUrl: item.imageUrl,
    publishedAt: item.publishedAt && item.publishedAt < fetchedAt ? item.publishedAt : fetchedAt,
  }));
}

export function latestPublished(rows: ItemRow[]): Date | null {
  return rows.reduce<Date | null>(
    (latest, { publishedAt }) => (!latest || publishedAt > latest ? publishedAt : latest),
    null
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/lib/feeds/ingest.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `src/lib/refresh.ts`**

The claim `updateMany` is the concurrency guard. Two page loads racing for the same due feed can't both fetch it.

```ts
import 'server-only';
import type { Feed } from '@/generated/prisma/client';
import prisma from '@/lib/db';
import { type FeedError, fetchFeed } from '@/lib/feeds/fetch';
import { nextFetchAt } from '@/lib/feeds/health';
import { latestPublished, toItemRows } from '@/lib/feeds/ingest';
import { FeedParseError, type ParsedFeed, parseFeed } from '@/lib/feeds/parse';

const POOL_SIZE = 6;
const CLAIM_MS = 2 * 60_000;
const MIN_MANUAL_INTERVAL_MS = 60_000;

async function claim(feedId: string, force: boolean, now: Date) {
  const where = force
    ? {
        id: feedId,
        OR: [
          { lastFetchedAt: null },
          { lastFetchedAt: { lte: new Date(now.getTime() - MIN_MANUAL_INTERVAL_MS) } },
        ],
      }
    : { id: feedId, nextFetchAt: { lte: now } };
  const { count } = await prisma.feed.updateMany({
    where,
    data: { lastFetchedAt: now, nextFetchAt: new Date(now.getTime() + CLAIM_MS) },
  });
  return count === 1;
}

async function recordFailure(feed: Feed, error: FeedError, now: Date) {
  const failCount = feed.failCount + 1;
  await prisma.feed.update({
    where: { id: feed.id },
    data: {
      failCount,
      lastError: error.message,
      lastErrorStatus: error.status,
      errorPermanent: error.permanent,
      nextFetchAt: nextFetchAt(failCount, now),
    },
  });
}

async function movedUrl(feed: Feed, finalUrl: string, movedPermanently: boolean) {
  if (!movedPermanently || finalUrl === feed.url) return {};
  const taken = await prisma.feed.findUnique({ where: { url: finalUrl }, select: { id: true } });
  return taken ? {} : { url: finalUrl };
}

const successFields = (now: Date) => ({
  lastSuccessAt: now,
  failCount: 0,
  lastError: null,
  lastErrorStatus: null,
  errorPermanent: false,
  nextFetchAt: nextFetchAt(0, now),
});

export async function refreshFeed(feedId: string, { force = false } = {}): Promise<void> {
  const now = new Date();
  if (!(await claim(feedId, force, now))) return;
  const feed = await prisma.feed.findUniqueOrThrow({ where: { id: feedId } });
  const result = await fetchFeed(feed.url, { etag: feed.etag, lastModified: feed.lastModified });

  if (result.kind === 'error') {
    await recordFailure(feed, result.error, now);
    return;
  }
  if (result.kind === 'not-modified') {
    await prisma.feed.update({
      where: { id: feed.id },
      data: { ...successFields(now), ...(await movedUrl(feed, result.finalUrl, result.movedPermanently)) },
    });
    return;
  }

  let parsed: ParsedFeed;
  try {
    parsed = parseFeed(result.body, result.finalUrl);
  } catch (error) {
    if (!(error instanceof FeedParseError)) throw error;
    await recordFailure(feed, { kind: 'not-a-feed', message: error.message, status: null, permanent: true }, now);
    return;
  }

  const rows = toItemRows(feed.id, parsed.items, now);
  const newest = latestPublished(rows);
  const siteUrl = parsed.siteUrl ?? feed.siteUrl;
  await prisma.$transaction([
    prisma.item.createMany({ data: rows, skipDuplicates: true }),
    prisma.feed.update({
      where: { id: feed.id },
      data: {
        ...successFields(now),
        ...(await movedUrl(feed, result.finalUrl, result.movedPermanently)),
        title: feed.title || parsed.title || new URL(feed.url).hostname,
        siteUrl,
        description: feed.description ?? parsed.description,
        iconUrl: parsed.iconUrl ?? feed.iconUrl ?? `${new URL(siteUrl ?? feed.url).origin}/favicon.ico`,
        etag: result.etag,
        lastModified: result.lastModified,
        latestItemAt: newest && (!feed.latestItemAt || newest > feed.latestItemAt) ? newest : feed.latestItemAt,
      },
    }),
  ]);
}

export async function refreshFeeds(feedIds: string[], options: { force?: boolean } = {}) {
  const queue = [...feedIds];
  const worker = async (): Promise<void> => {
    const feedId = queue.shift();
    if (!feedId) return;
    await refreshFeed(feedId, options).catch((error: unknown) => {
      console.error(`Refreshing feed ${feedId} failed`, error);
    });
    await worker();
  };
  await Promise.all(Array.from({ length: Math.min(POOL_SIZE, queue.length) }, worker));
}
```

- [ ] **Step 6: Verify types and lint**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS. All feed-library tests are green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/feeds/ingest.ts src/lib/feeds/ingest.test.ts src/lib/refresh.ts
git commit -m "Map parsed items to rows and add claim-guarded feed refresh service"
```

---

### Task 10: Better Auth with seeded anonymous guests

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/session.ts`, `src/lib/guest.ts`, `src/app/api/auth/[...all]/route.ts`, `src/components/GuestButton.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `prisma` (Task 8), `data/sample-feeds.json`
- Produces: `auth` (Better Auth instance), `authClient` (React client with the anonymous plugin), `getSession(): Promise<Session | null>`, `requireUser(): Promise<User>` (redirects to `/` when signed out, and Phase 2 changes this to `/sign-in`), `seedGuest(userId: string): Promise<void>`

Before writing code, read Better Auth's docs for the installed version: `node_modules/better-auth/README.md`, plus the anonymous plugin and Next.js integration pages it links. Adjust import paths if they differ from the ones below.

- [ ] **Step 1: Write `src/lib/guest.ts`**

```ts
import 'server-only';
import prisma from '@/lib/db';
import sampleFeeds from '../../data/sample-feeds.json';

export async function seedGuest(userId: string) {
  const feeds = sampleFeeds.categories.flatMap((category) => category.feeds);
  await prisma.feed.createMany({
    data: feeds.map(({ feedUrl, title, siteUrl, description }) => ({ url: feedUrl, title, siteUrl, description })),
    skipDuplicates: true,
  });
  const stored = await prisma.feed.findMany({
    where: { url: { in: feeds.map(({ feedUrl }) => feedUrl) } },
    select: { id: true, url: true },
  });
  const feedIds = new Map(stored.map(({ id, url }) => [url, id]));

  await Promise.all(
    sampleFeeds.categories.map(async ({ name, feeds: categoryFeeds }, position) => {
      const category = await prisma.category.upsert({
        where: { userId_name: { userId, name } },
        create: { userId, name, position },
        update: {},
      });
      await prisma.subscription.createMany({
        data: categoryFeeds.flatMap(({ feedUrl }) => {
          const feedId = feedIds.get(feedUrl);
          return feedId ? [{ userId, feedId, categoryId: category.id }] : [];
        }),
        skipDuplicates: true,
      });
    })
  );
}
```

- [ ] **Step 2: Write `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/session.ts` and the route**

```ts
import 'server-only';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { anonymous } from 'better-auth/plugins';
import prisma from '@/lib/db';
import { seedGuest } from '@/lib/guest';

export const auth = betterAuth({
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
```

```ts
import { anonymousClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({ plugins: [anonymousClient()] });
```

```ts
import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect('/');
  return session.user;
}
```

`src/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 3: Write `src/components/GuestButton.tsx` and the landing stub**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { authClient } from '@/lib/auth-client';

export default function GuestButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const tryAsGuest = () =>
    startTransition(async () => {
      setError(null);
      const { error: signInError } = await authClient.signIn.anonymous();
      if (signInError) {
        setError("We couldn't start a guest session. Please try again.");
        return;
      }
      router.push('/app');
    });

  return (
    <div className='flex flex-col items-center gap-2'>
      <button
        type='button'
        onClick={tryAsGuest}
        disabled={isPending}
        className='min-h-11 rounded-md bg-accent px-5 font-semibold text-white hover:bg-accent-hover disabled:opacity-60'
      >
        {isPending ? 'Setting up your front page…' : 'Try as guest'}
      </button>
      {error && (
        <p role='alert' className='text-sm text-error'>
          {error}
        </p>
      )}
    </div>
  );
}
```

`src/app/page.tsx`:

```tsx
import Link from 'next/link';
import GuestButton from '@/components/GuestButton';
import { getSession } from '@/lib/session';

export default async function Home() {
  const session = await getSession();
  return (
    <main id='main' className='grid min-h-dvh place-items-center px-4'>
      <div className='max-w-content text-center'>
        <h1 className='text-2xl font-bold md:text-3xl'>Your personalized front page for tech content.</h1>
        <p className='mt-4 text-text-secondary'>
          Blogs, newsletters and changelogs in one calm, organized place.
        </p>
        <div className='mt-8'>
          {session ? (
            <Link href='/app' className='font-semibold text-accent underline'>
              Open your front page
            </Link>
          ) : (
            <GuestButton />
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify sign-in and seeding**

Run: `pnpm dev`, open `http://localhost:3000`, click **Try as guest**. The browser lands on `/app`, which 404s until Task 11. That's expected.

Run: `psql frontpage -c 'select "isAnonymous", count(*) from "user" group by 1' -c 'select count(*) from "Subscription"' -c 'select count(*) from "Category"' -c 'select count(*) from "Feed"'`
Expected: one anonymous user, 19 subscriptions, 5 categories, 19 feeds. If the hook didn't fire (0 subscriptions), Better Auth's hook `user` lacks `isAnonymous`. Seed instead from the anonymous plugin's server hook. Check its docs for the option name in this version, then re-verify.

Run: `pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth-client.ts src/lib/session.ts src/lib/guest.ts src/app/api src/components/GuestButton.tsx src/app/page.tsx
git commit -m "Add Better Auth with anonymous guests seeded from the curated feeds"
```

---

### Task 11: Bare `/app` item list with background refresh

**Files:**
- Create: `src/lib/items.ts`, `src/components/ItemList.tsx`, `src/app/app/page.tsx`

**Interfaces:**
- Consumes: `requireUser` (Task 10), `refreshFeeds` (Task 9), `prisma`
- Produces:

```ts
export function feedsToRefresh(userId: string): Promise<{ neverFetched: string[]; due: string[] }>;
export function listItems(userId: string, take?: number): Promise<ListedItem[]>;
export type ListedItem = { id: string; title: string; url: string | null; excerpt: string; publishedAt: Date;
  feed: { title: string; iconUrl: string | null } };
```

Phase 3 replaces this list with the real one. Keep it minimal.

- [ ] **Step 1: Write `src/lib/items.ts`**

```ts
import 'server-only';
import prisma from '@/lib/db';

export async function feedsToRefresh(userId: string) {
  const now = new Date();
  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    select: { feed: { select: { id: true, lastFetchedAt: true, nextFetchAt: true } } },
  });
  const feeds = subscriptions.map(({ feed }) => feed);
  return {
    neverFetched: feeds.filter(({ lastFetchedAt }) => !lastFetchedAt).map(({ id }) => id),
    due: feeds
      .filter(({ lastFetchedAt, nextFetchAt }) => lastFetchedAt && nextFetchAt <= now)
      .map(({ id }) => id),
  };
}

export function listItems(userId: string, take = 50) {
  return prisma.item.findMany({
    where: { feed: { subscriptions: { some: { userId } } } },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    take,
    select: {
      id: true,
      title: true,
      url: true,
      excerpt: true,
      publishedAt: true,
      feed: { select: { title: true, iconUrl: true } },
    },
  });
}

export type ListedItem = Awaited<ReturnType<typeof listItems>>[number];
```

- [ ] **Step 2: Write `src/components/ItemList.tsx`**

The first guest ever triggers 19 cold fetches (worst case: 4 pool rounds × 10 s). The page waits at most `INITIAL_WAIT_MS`, and `after()` keeps the rest running past the response.

```tsx
import { after } from 'next/server';
import { setTimeout } from 'node:timers/promises';
import { feedsToRefresh, listItems } from '@/lib/items';
import { refreshFeeds } from '@/lib/refresh';

const INITIAL_WAIT_MS = 8_000;
const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

export default async function ItemList({ userId }: { userId: string }) {
  const { neverFetched, due } = await feedsToRefresh(userId);
  const initialRefresh = refreshFeeds(neverFetched);
  after(() => Promise.all([initialRefresh, refreshFeeds(due)]));
  await Promise.race([initialRefresh, setTimeout(INITIAL_WAIT_MS)]);
  const items = await listItems(userId);

  if (!items.length) {
    return <p className='py-12 text-center text-text-secondary'>No items yet. Your feeds are still loading.</p>;
  }

  return (
    <ul className='divide-y divide-border-subtle'>
      {items.map((item) => (
        <li key={item.id} className='py-4'>
          <article>
            <h2 className='text-lg font-medium'>
              {item.url ? (
                <a href={item.url} target='_blank' rel='noopener noreferrer' className='hover:text-accent'>
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </h2>
            <p className='mt-1 text-xs text-text-tertiary'>
              {item.feed.title} ·{' '}
              <time dateTime={item.publishedAt.toISOString()}>{dateFormat.format(item.publishedAt)}</time>
            </p>
            {item.excerpt && <p className='mt-1 line-clamp-2 text-sm text-text-secondary'>{item.excerpt}</p>}
          </article>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Write `src/app/app/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { Suspense } from 'react';
import ItemList from '@/components/ItemList';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'All items' };

export default async function AppPage() {
  const user = await requireUser();
  return (
    <main id='main' className='mx-auto max-w-feed px-4 py-8'>
      <h1 className='text-xl font-semibold'>All items</h1>
      <Suspense fallback={<p className='py-12 text-center text-text-secondary'>Loading your feeds…</p>}>
        <ItemList userId={user.id} />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 4: Verify end to end**

Run: `pnpm dev`. In a fresh private window, open `http://localhost:3000` → **Try as guest**.
Expected: "Loading your feeds…" for at most ~8 s, then up to 50 items newest-first from several sources, with clean titles (no `&amp;`, `&#8217;` or tags).

Run: `psql frontpage -c 'select title, "failCount", "lastError", "lastSuccessAt" is not null as ok, (select count(*) from "Item" i where i."feedId" = f.id) as items from "Feed" f order by "failCount" desc, title'`
Expected: most feeds `ok = t` with items > 0, and Hacker News Best with many items. Any failing feed shows a human-readable `lastError` (e.g. "The feed's server refused the request (403)"). Record failing feeds in the PR description. They're Phase 4 health-dashboard material, not Phase 1 bugs, unless the error is a parse failure on a valid feed.

Reload `/app`. The page renders immediately (no new blocking fetch), because feeds are now due only after 15 minutes.

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all PASS.

- [ ] **Step 5: Commit and open the PR**

```bash
git add src/lib/items.ts src/components/ItemList.tsx src/app/app
git commit -m "Show guest items with background feed refresh"
git push -u origin rss-feed-reader
gh pr create --title "Frontpage phase 1: foundation" --body "Feed parsing/fetching library with tests, Prisma schema, Better Auth guests seeded with curated feeds, and a bare item list. Roadmap: RSS-feed-reader/docs/plans/2026-10-08-frontpage-roadmap.md"
```

---

## Self-Review Notes

- **Spec coverage (Phase 1 slice):** Core 2: RSS 2.0/Atom/RDF (Task 5), encodings (Task 3), entities (Tasks 4–5), missing fields (Task 5), date formats (Task 2), full HTML vs. summary (`contentHtml` rule, Task 5), malformed XML (Task 5). Tech req: 10 s timeout, redirects with permanent-URL update, ETag/Last-Modified (Tasks 6, 9). Rate limiting is the claim guard + backoff + 60 s manual minimum + pool of 6 (Tasks 7, 9). Core 11: one-click guest seeded with 19 feeds / 5 categories (Task 10). Core 12: real Postgres schema (Task 8).
- **Deferred on purpose:** item retention, orphan-feed cleanup and guest expiry (Phase 2/6 maintenance cron), and `ItemState`/`Preference` tables (Phases 3/6–8, created when first used).
- **Type consistency:** `FeedError`/`FetchResult` (Task 6) are consumed unchanged in Task 9. `ParsedItem` (Task 5) feeds `toItemRows` (Task 9). `nextFetchAt(failCount, now)` matches across Tasks 7 and 9. `seedGuest(userId)` and `requireUser()` match across Tasks 10 and 11.
