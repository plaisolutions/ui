---
"@plaisolutions/react": patch
---

Make tool and memory cards consistent.

- Browser and email cards expand and collapse from anywhere on the header, with a chevron instead of the +/- button.
- Cards with a header (generic tool result, email, memory proposal) no longer pad the whole card: the header has a bottom border and the header and body are padded `px-3 py-2`, like the personal connector and browser cards.
- Memory proposals show a clock icon while waiting for review and an X icon when they are rejected, expired, or conflicted.
- Every card's root element has a stable `plai-<component>` class (for example `plai-tool-result-browser-card` or `plai-memory-proposal-card`) that hosts can target.
