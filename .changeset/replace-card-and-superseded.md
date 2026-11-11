---
"@plaisolutions/react": patch
---

Draw the result of `replace_pending_action` as the mail or event it carries, and fold replaced versions.

- The result of `replace_pending_action` (a `tool_confirmation` result with the connector's metadata) was routed to the generic card, which showed the tool name and the arguments as JSON. It now renders as the mail or calendar card, like preparing the action did, with the same buttons. Routing follows the result's metadata, so history that is already persisted is fixed too.
- A version that was replaced folds into one line (what it was, "replaced by a newer version" and a link) instead of repeating a whole card for every change.
- "See the newer version" now works from any card (the generic card was missing the attribute it looks for) and flashes the card it scrolls to.
- Exports `showAction`.
