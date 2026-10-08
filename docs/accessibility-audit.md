# Accessibility audit

Audited 2026-10-09 against `guidance/accessibility.md` (WCAG 2.1 AA). "Code" = checked by reading the markup and styles; "Script" = checked by a script; "Manual" = still needs a person with assistive technology.

## Perceivable
- [x] Contrast AA: brand tokens fixed for small text (README); high-contrast theme ≥ 7:1 everywhere (Script).
- [x] Color never alone: feed health = icon + text, unread = dot + weight + "Unread:" sr-only prefix, saved = `aria-pressed` + icon fill (Code).
- [x] Links distinguishable: in-text links are underlined; list titles sit in list rows, not running text (Code).
- [x] Feed images: list thumbnails are decorative `alt=""`; article images keep the feed's alt (sanitizer allows `alt`) (Code).
- [x] Favicons decorative next to the feed name (Code).
- [x] No images of text (Code).
- [x] Heading hierarchy h1 → h2 per view; article content keeps its own levels (see Known limitations) (Code).
- [x] Landmarks: `header`, `nav`, `main`, `aside` (desktop sidebar), `footer` (Code).
- [x] Item lists are `ul`/`li` (Code).
- [x] Tables: none in the UI; feed tables scroll horizontally.
- [x] Unique page titles via the `%s · Frontpage` template (Code).

## Operable
- [x] Tab reachability, logical order, `:focus-visible` outline on every control (Code).
- [x] No traps; drawer, shortcut sheet and palette are native `dialog`/Radix dialog with focus trap and restore (Code).
- [x] Shortcuts are single letters, ignored in inputs and open dialogs, and can be avoided entirely; ⌘K is the only modifier combo (Code).
- [x] Skip link (Code).
- [x] `aria-current` on sidebar, view switch and digest window links (Code).
- [x] Location shown by page heading + current link; reader has "Back to list" (Code).
- [x] Multiple ways: sidebar, search, palette, digest (Code).
- [x] New items wait behind a "Show N new items" button; scroll position kept on insert (Code; Phase 6 check).
- [x] Guest 24 h limit documented on the guest banner and `/accessibility`.
- [x] `prefers-reduced-motion` plus an explicit Reduce motion preference (Code).

## Understandable
- [x] Visible labels on all fields (Code).
- [x] Errors linked via `aria-describedby` + `aria-invalid` (Code).
- [~] Required fields: native `required` (programmatic); no visual marker, since every auth field is required and the forms say so in context.
- [x] Server errors keep entered values (`useActionState` forms) (Code).
- [x] Specific feed URL errors (Phase 1 fetcher messages) (Code).
- [x] `<html lang="en">` (Code).
- [ ] `lang` on foreign-language feed content: not detected yet.
- [x] Plain-language errors (Code).

## Robust
- [x] ARIA: toggles use `aria-pressed`, disclosure `aria-expanded`, live updates through one polite announcer (`Announcer.tsx`) (Code).
- [x] Refresh, new items, mark-all-read and undo are announced (Code).
- [x] Item rows read title → source → date (Code).

## Beyond AA
- [x] Font, size, line height, line length (Settings).
- [x] High contrast theme.
- [x] Reduce motion.
- [x] `?` shortcut sheet.
- [ ] **Manual:** VoiceOver pass (Safari, macOS) on list, reader, settings, palette. Pending.
