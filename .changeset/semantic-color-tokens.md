---
"@plaisolutions/react": minor
---

Components use semantic color tokens instead of hardcoded palette classes, so they follow the light and dark themes.

- New tokens exposed as Tailwind utilities: surfaces (`bg-surface`, `bg-surface-muted`, `bg-surface-subtle`, `bg-surface-hover`), inverse (`bg-inverse`, `text-inverse-foreground`), borders (`border-border`, `border-border-strong`, `border-divider`), text (`text-foreground`, `text-strong`, `text-secondary`, `text-muted`), focus (`outline-ring`) and status colors (`danger`, `warning`, `success`, `info`, each with `-strong`, `-subtle` and `-border`).
- Values are CSS variables (`--plai-*`) defined in `:root` and `.dark`. Hosts can override them to match their own theme.
- The light theme looks the same, except that some neighbouring palette shades now share a token.
- Dark mode no longer shows light-only surfaces, borders, or focus rings in cards, badges, sheets, and buttons.
