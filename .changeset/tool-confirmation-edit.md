---
"@plaisolutions/client": minor
"@plaisolutions/react": minor
---

Edit pending actions from their cards and follow replaced versions (phase 3b of tool confirmations).

`@plaisolutions/client`: `ToolDecision.arguments` is an edit patch sent with `confirm`. A rejected edit (HTTP 422 `invalid_tool_decision`) no longer counts as a chat failure: the local message is undone and `decideToolActions` rejects with `ToolDecisionRejectedError`, carrying the field errors in `details`; the invocation settles as `completed` with `didSend: false`. `PendingConfirmation.editable` now lists the editable fields, and `ToolConfirmationState` / `ToolConfirmationItem` expose `effectiveAction`, `supersedes` and `supersededBy`. New types `ToolActionSuperseded` and `ToolDecisionError`. **Hosts that build `ToolConfirmationState` objects by hand must add the three new fields** (`effectiveAction`, `supersededBy`, `supersedes`).

`@plaisolutions/react`: pending mail and calendar cards show "Edit" when the server declares editable fields. The inline form checks recipients, plain text and dates on the device, shows event times in the action's own time zone and sends them with that zone's UTC offset (an ambiguous or nonexistent local time is refused), keeps the draft on errors, and "Save and send/confirm" runs the action with only the changed fields. After an edit the card shows what ran; a replaced version is dimmed and links to its successor. New texts in the 10 supported languages.
