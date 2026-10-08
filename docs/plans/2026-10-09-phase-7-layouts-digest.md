# Phase 7: Layouts + Digest

Covers design challenges 2 (Digest) and 3 (Layout customization), per roadmap § Phase 7.

## Decisions
- `Preference.layout` ('compact' | 'comfortable' | 'cards', default comfortable) and `Preference.digestSeenAt`.
- Toolbar layout switcher: `radiogroup` of three radios, saved by a server action, list re-renders.
- Compact: one line. Comfortable: title, 2-line excerpt, meta, small right thumbnail. Cards: image-led grid; no image → tinted panel with favicon + source name.
- Digest windows: since last digest (fallback 24 h), last 24 hours, last 7 days. "Today" is "Last 24 hours" because the server doesn't know the user's timezone.
- `rankDigest` (pure, tested): score = 0.5^(age h / 12) × 1/log2(2 + feed items in last 7 d), max 2 per feed, grouped by category, top 5 per group with "N more". Under 8 items → flat list + "That's everything".
- "Done — mark these read" marks the shown ids read and sets `digestSeenAt`.

## Deferred
- Split-pane reader on wide screens: needs parallel/intercepting routes. Revisit in Phase 10 polish.
- Per-category layouts: out on purpose (one mental model).
