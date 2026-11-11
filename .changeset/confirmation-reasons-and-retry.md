---
"@plaisolutions/client": minor
"@plaisolutions/react": minor
---

Show why an action did not run, translate the server's field errors, and make retries of a decision safe.

`@plaisolutions/client`:
- `ToolDecisionError.errors[]` carries the server's stable `code` next to `message`.
- A submission the server already has under its `decision_request_id` (HTTP 409 `decision_in_progress` / `decision_request_conflict`) is not a chat failure: the local message is undone and `decideToolActions` rejects with `ToolSubmissionConflictError` (`details.code`, `details.executionId`). The invocation settles as `completed` with `didSend: false`. New `PlaiChatError.toolSubmission`.
- Sending the same decisions again after a submission that ended in an error reuses its key, so the server answers from what it recorded (same result, or "still being applied") instead of applying anything twice. Any change of decisions, edits, text or tools gets a new key.

`@plaisolutions/react`:
- A card whose action ended `invalidated` or `unknown` says why (`configuration_changed`, `no_snapshot`, `resource_changed`, `outcome_unknown`, `interrupted`), in the 10 languages.
- The field errors of a rejected edit are translated by `code` (the English message is the fallback for a code the client does not know).
- A card whose submission is already being applied says so instead of reporting a failure.
- Exports `reasonLabel`.
