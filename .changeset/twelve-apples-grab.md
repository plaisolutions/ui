---
"@plaisolutions/client": minor
"@plaisolutions/react": minor
---

Improve tool call typing and email tool-call rendering.

- `@plaisolutions/client`
  - Added `UIToolType` and converted `UIToolCallPart` into a discriminated union by backend tool type.
  - Added explicit tool-call part variants (for example `UIEmailSendToolCallPart`, `UIPerplexityToolCallPart`, `UIWorkflowDispatchToolCallPart`, and `UIUnknownToolCallPart`) and exported them.
  - Removed `metadata` from `SendMessageInput` to align the public input contract with the invoke endpoint payload.

- `@plaisolutions/react`
  - Added specialized rendering for `email_send` tool calls via `ToolResultEmailSendCard`.
  - Added a collapsible UI for email details (subject/to always visible, body/delivery on expand).
  - Added Storybook coverage for assistant messages with an email tool call.
