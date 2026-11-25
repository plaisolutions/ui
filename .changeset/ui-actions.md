---
"@plaisolutions/client": minor
---

Support the `ui_action` SSE event, the UI effect a tool declares and the host app executes.

Until now an unknown event type made the stream fail with a `ProtocolError`, so an agent whose tool declares a `ui_action` could not be used with an older version: upgrade before configuring one.

- Adds the `UiActionEvent`, `UiActionEffect`, `UiActionContext`, `UiActionHandler(s)` and `UiActionIssue` types, and `PlaiChatOptions.uiActionHandlers` (the handlers, or a function read on every effect) and `onUiActionIssue`.
- `PlaiChat.uiActions` (a `UiActionDispatcher`) runs the handler registered for the effect's `action` as soon as the event arrives, without waiting for the `tool_result` (which never comes when the agent hides its tool calls). Effects are deduplicated by `action_id`; a missing handler (`ui_action.unmapped`) or a handler that throws or rejects (`ui_action.failed`) is reported through `onUiActionIssue` and never interrupts the stream.
- `uiActions.setHandlers(handlers)` replaces the handlers; `uiActions.replay(chat.getState().messages)` re-applies, in order, the `replayable` effects stored in the history (`metadata.ui_action` of the tool results), with `context.replay === true`.
