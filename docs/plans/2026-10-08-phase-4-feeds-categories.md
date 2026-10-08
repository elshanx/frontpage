# Phase 4: Feeds & Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (or subagent-driven-development). Steps use `- [ ]`.
>
> On approval, Task 0 copies this file to `RSS-feed-reader/docs/plans/2026-10-08-phase-4-feeds-categories.md` (worktree `/Users/elshanx/dev/projects/fem-rss-feed-reader`, branch `rss-feed-reader`) and commits it. All paths are relative to `RSS-feed-reader/`.

## Context

Phases 1–3 shipped the feed library, accounts, guests and the reading core (sidebar, list, reader, read state). Users still can't add, edit or remove feeds, manage categories, or see feed health beyond a plain-text "N feeds need attention" line. A fresh (non-guest) account lands on an empty `/app`. Phase 4 covers spec Core 1 (feed management), Core 4 (categories) and the UI part of Core 8 (error handling), per roadmap § Phase 4.

**Decision (user, 2026-10-08): category reorder uses up/down buttons only.** No dnd-kit. Spec allows "drag-and-drop or manual ordering".

**Outcome:**
- `/app/feeds`: add a feed by URL (site URLs are auto-discovered), see title/description/icon on success, edit custom title + category, remove with a `<dialog>` confirm.
- Health dashboard on the same page: counts by status (active/stale/error/dead, icon + text), last successful fetch, last error in plain language, Retry (forced, 60 s minimum — `refreshFeed(id, { force: true })` already enforces it).
- Categories: create, rename, delete (feeds become Uncategorized via the existing `onDelete: SetNull`), reorder with up/down buttons.
- Empty `/app` for accounts with no subscriptions: 5 starter packs (one click each) and "Add a feed URL".
- SSRF minors deferred from Phase 1 are closed before user-supplied URLs go live.

## Global Constraints

- Inherit roadmap + Phase 1–3 constraints: Next 16 (async params, `refresh()` from `next/cache` in actions), Prisma 7, pnpm, airbnb ESLint + Prettier, default export for single-export files, no comments except non-obvious *why*, no `any`.
- **Read before coding:** `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/refresh.md`, `after.md`, and the `useActionState` / forms guide under `01-app/02-guides/`.
- No new dependencies. Native `<dialog>`, `useActionState`, `useFormStatus` (existing `SubmitButton`), htmlparser2 (installed) for discovery.
- Pure modules go in `src/lib/feeds/` or `src/lib/manage/` with relative `.ts` imports and `import type`. Add `src/lib/manage/**/*.ts` to the `project/node-test-modules` glob in `eslint.config.mjs`.
- Every action calls `requireUser()` and scopes writes by `userId`. A `categoryId` or `subscriptionId` owned by another user is a no-op (use `updateMany`/`deleteMany` with `userId` in `where`, and verify category ownership before assigning it).
- Feed titles, descriptions and errors render as text, never HTML.
- Run `pnpm lint` unpiped; check its exit code.

## Review Focus

1. **Cross-user writes:** edit/remove/retry with another user's subscription id; assigning another user's category id; renaming/deleting/reordering another user's category. All no-ops. Pinned in Task 3 and Task 8 step 2.
2. **SSRF via add-feed:** `http://localhost`, `http://169.254.169.254`, `http://[::1]`, a NAT64/6to4-embedded private IP, a hostname whose DNS hangs. Specific error, no hang past 10 s. Pinned in Task 1.
3. **Discovery abuse:** an HTML page whose `<link rel=alternate>` points to another HTML page must not loop — discovery is one hop only, and the discovered URL goes through the same `fetchFeed` guard. Pinned in Task 2/3.
4. **Unsubscribe data:** removes the subscription and that user's `ItemState` rows for the feed; other users' rows and the shared `Feed`/`Item` rows are untouched (orphans are Phase 6 cron). Pinned in Task 3.
5. **Duplicate add:** adding a feed already subscribed (same final URL) says "You already follow this feed", never creates a second row.

## File Structure

```
src/lib/feeds/fetch.ts           DNS timeout, extra private ranges            (T1)
src/lib/feeds/discover.ts(+test) discoverFeedUrls(html, baseUrl): string[]    (T2)
src/lib/manage/
  order.ts(+test)    moveItem(ids, id, direction): string[]                    (T2)
  names.ts(+test)    parseCategoryName(raw): string | null (trim, collapse ws, 1–40 chars) (T2)
  health.ts(+test)   summarizeHealth(feeds, now): Record<FeedHealth, number>  (T2)
src/lib/subscriptions.ts [server-only]  previewFeed, subscribe, updateSubscription, unsubscribe,
                         retryFeed, listManagedFeeds, createCategory, renameCategory,
                         deleteCategory, moveCategory, subscribeStarterPack   (T3)
src/lib/guest.ts         seedGuest reuses subscribeStarterPack                 (T3)
src/app/app/feeds/actions.ts  'use server' wrappers                            (T3)
src/app/app/feeds/page.tsx    health summary, add form, categories, feed list   (T4, T5)
src/components/
  AddFeedForm.tsx (client, useActionState), FeedRow.tsx, HealthBadge.tsx,
  EditFeedDialog.tsx, ConfirmDialog.tsx, CategoryManager.tsx              (T4, T5)
  StarterPacks.tsx                                                          (T6)
src/components/Sidebar.tsx       health line → link to /app/feeds; "Manage feeds" link (T6)
src/app/app/page.tsx             empty state when user has no subscriptions    (T6)
```

---

### Task 0: Save the plan
- [ ] Copy this plan to `docs/plans/2026-10-08-phase-4-feeds-categories.md`. Commit: "Add Phase 4 feeds and categories plan".

### Task 1: Close Phase 1 SSRF minors (TDD)
- [ ] Tests in `fetch.test.ts`: `isPrivateAddress` true for `64:ff9b::7f00:1` (NAT64 of 127.0.0.1), `2002:7f00:1::` (6to4 of 127.0.0.1), `240.0.0.1`, `::ffff:10.0.0.1`; false for `8.8.8.8`, `2606:4700::1111`. A DNS lookup that never resolves fails with kind `dns` within the timeout (inject via `lookup` option or test with `timeoutMs` and an unroutable `.invalid` host — pick whichever the existing test file already patterns).
- [ ] Implement: for `64:ff9b::/96` and `2002::/16`, extract the embedded IPv4 and recurse (like the existing `::ffff:` branch). Race `lookup` against the request `signal` so DNS can't outlive the 10 s budget.
- [ ] Keep the existing DNS-rebinding `ponytail:` comment (pinning needs an undici dispatcher = new dep; app runs on Vercel, not inside a private network).
- [ ] `pnpm test` green, `pnpm lint` exit 0. Commit: "Block NAT64/6to4-embedded private addresses and bound DNS lookups by the fetch timeout".

### Task 2: Pure helpers (TDD)
```ts
// feeds/discover.ts
export default function discoverFeedUrls(html: string, baseUrl: string): string[];
//   <link rel~=alternate type=application/(rss|atom)+xml|application/feed+json? href> → absolute http(s) URLs via httpUrl(), deduped, document order; [] if none
// manage/order.ts
export default function moveItem(ids: string[], id: string, direction: 'up' | 'down'): string[];
//   unchanged copy if id missing or already at the edge
// manage/names.ts
export default function parseCategoryName(raw: unknown): string | null;
// manage/health.ts
export default function summarizeHealth(feeds: FeedHealthInput[], now: Date): Record<FeedHealth, number>;
```
- [ ] Tests: discovery on a page with RSS + Atom + unrelated `<link rel=stylesheet>`, relative href, `rel="alternate feed"`, `javascript:` href dropped, uppercase attrs; moveItem edges; names (`'  a  b '`→`'a b'`, `''`/41 chars/non-string → null); summary counts all five buckets.
- [ ] Run → fail → implement → `pnpm test` green, lint 0. Commit: "Add feed discovery, category name, reorder and health summary helpers".

### Task 3: Subscription + category service and actions
`src/lib/subscriptions.ts` (`import 'server-only'`, reuses `fetchFeed`, `parseFeed`, `refreshFeed`, `feedHealth`):
- [ ] `previewFeed(rawUrl)`: `fetchFeed` → `parseFeed`. On `FeedParseError`, if the body looks like HTML, `discoverFeedUrls` and try the **first** candidate once (no recursion). Returns `{ ok: true, url: finalUrl, title, description, iconUrl, siteUrl }` or `{ ok: false, message }` (messages come from `FeedError.message` / `FeedParseError.message`, plus "We couldn't find a feed on that page").
- [ ] `subscribe(userId, rawUrl, categoryId | null)`: preview; if subscribed already → error message; `feed.upsert` by `url` with parsed metadata; verify `categoryId` belongs to user (else null); create `Subscription`; `await refreshFeed(feed.id)` so items exist when the user lands (claim succeeds because `nextFetchAt` defaults to now; for an existing fresh feed the claim no-ops, which is correct). Returns the preview for display.
- [ ] `updateSubscription(userId, subscriptionId, { title, categoryId })`: `updateMany where { id, userId }`; empty title → null (falls back to feed title — confirm `getNavigation`/list already use `s.title ?? f.title`; if not, switch them in the same commit).
- [ ] `unsubscribe(userId, subscriptionId)`: one transaction: find sub by `{ id, userId }`; `deleteMany ItemState where userId and item.feedId = sub.feedId`; delete sub. (No `savedAt` yet; Phase 5 adds the `savedAt IS NULL` condition — leave a `ponytail:` marker.)
- [ ] `retryFeed(userId, subscriptionId)`: owned-sub lookup, then `refreshFeed(feedId, { force: true })`. Returns `{ retried: boolean }` (false when inside the 60 s window → UI says "Retried less than a minute ago").
- [ ] `listManagedFeeds(userId)`: subscriptions with feed fields needed for `feedHealth` + `lastSuccessAt`, `lastError`, `iconUrl`, `description`, grouped like the sidebar (categories by position, then Uncategorized).
- [ ] Categories: `createCategory` (position = max+1; unique-name conflict → "You already have a category with that name"), `renameCategory`, `deleteCategory` (`deleteMany where { id, userId }`; SetNull moves feeds), `moveCategory(userId, id, direction)` (load ordered ids, `moveItem`, rewrite positions in one `$transaction` of `updateMany where { id, userId }`).
- [ ] `subscribeStarterPack(userId, categoryName)`: extract the per-category body of `seedGuest` (feed `createMany skipDuplicates` → category upsert → subscription `createMany`); `seedGuest` becomes a loop over all 5 packs. Then schedule `after(() => refreshFeeds(ids))` in the action, not in the lib.
- [ ] `src/app/app/feeds/actions.ts`: thin `'use server'` wrappers — `requireUser()`, validate ids with `ID_PATTERN`, names with `parseCategoryName`, then call the service and `refresh()`. Form actions take `(prevState, formData)` for `useActionState`.
- [ ] `pnpm typecheck`, `pnpm lint` exit 0; `pnpm test` still green (guest seed unchanged behaviour). Commit: "Add subscription, category and starter-pack services with scoped actions".

### Task 4: `/app/feeds` — add feed + feed list + health
- [ ] `page.tsx` (server): `requireUser`, `listManagedFeeds`, `summarizeHealth`. Sections with `<h2>`s: "Feed health", "Add a feed", "Categories" (Task 5), "Your feeds".
- [ ] `HealthBadge`: icon + text label per status (`Active`, `Stale`, `Error`, `Dead`, `Checking…` for pending); color is never the only signal. Summary row: four badges with counts, e.g. "16 active · 1 stale · 2 error".
- [ ] `AddFeedForm` (client, `useActionState`): `<label>` URL input (`type=url`, `inputMode=url`), category `<select>` (incl. Uncategorized), `SubmitButton` showing "Checking feed…". Error via existing `FormError` + `aria-describedby`; value preserved on error. Success renders a card (icon via `FeedIcon`, title, description) in an `aria-live=polite` region and resets the input.
- [ ] `FeedRow`: icon, display title, health badge, "Last updated <relativeTime>" with `<time dateTime title=full date>` (or "Never fetched"), last error text when failing, and actions: Retry (only when error/dead/stale), Edit, Remove.
- [ ] `EditFeedDialog`: native `<dialog>` (`showModal`), title input (placeholder = feed's own title), category select, Save/Cancel; Escape closes; focus returns to the trigger.
- [ ] `ConfirmDialog`: generic `<dialog>` with message + destructive confirm button that submits a form action. Used by Remove ("Unsubscribe from X? Your read history for it will be removed.") and category delete.
- [ ] Browser check at 375 px and 1440 px. Commit: "Add feed management page with add, edit, remove, retry and health summary".

### Task 5: Category manager
- [ ] `CategoryManager` (client) on `/app/feeds`: create form; per row: name, feed count, Rename (inline form toggled by a button, `useActionState`), Up/Down buttons (`aria-label="Move Design up"`, disabled at edges, focus stays on the moved row's same button after `refresh()`), Delete via `ConfirmDialog` ("Its N feeds move to Uncategorized"). Uncategorized is shown as a fixed, non-editable last row.
- [ ] 44×44 touch targets on coarse pointers. Commit: "Add category create, rename, delete and reorder".

### Task 6: Sidebar links + empty state with starter packs
- [ ] `Sidebar.tsx`: wrap the "N feeds need attention" line in a `Link` to `/app/feeds`; add a "Manage feeds" link at the bottom.
- [ ] `/app/page.tsx`: when the user has zero subscriptions (`getNavigation` already returns groups — check `uncategorized.length + categories.length === 0`), render `StarterPacks` instead of the list: heading "Start with a few feeds", 5 cards from `data/sample-feeds.json` (name, feed count, 2–3 feed titles), each a form button "Add <name> pack" → `subscribeStarterPackAction`; plus a link "Or add a feed by URL" → `/app/feeds#add`. No "Import OPML" until Phase 5 (no dead links).
- [ ] Commit: "Link sidebar to feed management and add starter packs for empty accounts".

### Task 7: Verification (end of phase)
1. `pnpm test` (Phase 1–3 tests + Tasks 1–2), `pnpm lint`, `pnpm typecheck`, `pnpm build` each exit 0, unpiped.
2. **Scoping:** as user A, call edit/remove/retry/rename/delete/move actions with user B's ids (temporary devtools form or a scratch script). `psql` shows B's rows unchanged. Assigning B's category to A's subscription stores `null`.
3. **Add feed:** a direct feed URL (e.g. `https://overreacted.io/rss.xml`), a site URL needing discovery (`https://css-tricks.com`), a 404, `http://localhost:3000`, `http://169.254.169.254/`, a non-feed HTML page without alternates, and a duplicate. Each gives the expected card or plain-language error.
4. **Health:** force a feed into error (`update "Feed" set "failCount"=2, "lastError"='…'`), see it in the dashboard with last success time and Retry; Retry twice within 60 s → second says "less than a minute ago".
5. **Categories:** create, rename, reorder (sidebar order follows), delete → its feeds appear under Uncategorized in sidebar and list.
6. **Empty state:** sign up a new account, add one starter pack, items appear after refresh; guest seeding still gives 19 feeds in 5 categories.
7. Keyboard-only pass of `/app/feeds`: dialogs trap focus and restore it, reorder buttons usable, errors announced.
8. Final whole-branch review (fresh reviewer) against Review Focus, one TDD fix pass, then push and open a PR for Phase 4.

## Deferred (not Phase 4)
- OPML import/export, `savedAt` (and keeping saved items on unsubscribe): Phase 5.
- Refresh-all, per-feed refresh progress, "Last updated" in the toolbar, orphan-feed cleanup: Phase 6.
- Drag-and-drop reorder: not planned (user decision).
- DNS-rebinding IP pinning: stays a `ponytail:` note (needs undici dep).
