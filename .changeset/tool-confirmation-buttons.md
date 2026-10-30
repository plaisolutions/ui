---
"@plaisolutions/client": minor
"@plaisolutions/react": minor
---

Confirm or cancel actions awaiting the user's confirmation from their cards.

- Client: `PlaiChat.decideToolActions(decisions, { text? })` sends `tool_decisions` + `decision_request_id` in the next invoke (also on `ChatInvocation` of `ChatRegistry`); a decisions-only message is hidden (`isHiddenMessage`). `refreshToolConfirmations()` and `PlaiThreadTransport.getToolConfirmations()` read the thread's persisted state. `chat.toolConfirmations` keeps each action's state, only moving forward by `state_version`, with expiry from the server clock. `PendingConfirmation` gains `kind`, `operation`, `editable`, `expires_at`, `state_version`; `ConfirmedAction` gains the full status set, `state_version` and `decision_applied`.
- React: pass `toolConfirmation={{ states, decide, disabled }}` in `messagePartsProps` (or to `ToolResultCard`) to show Send / Create / Save changes / Delete and Cancel buttons, progress, countdown and outcomes in 10 languages. `useChat` returns `chat`, `toolConfirmations`, `decideToolActions` and `refreshToolConfirmations`; `useToolConfirmationSync(chat)` refreshes on load, focus and while an action is open. `Message` no longer renders hidden messages. Without `toolConfirmation`, cards keep the "reply yes" hint.
