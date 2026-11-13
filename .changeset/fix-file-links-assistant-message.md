---
"@plaisolutions/react": patch
---

Fix `resolveFileLinks` in `Message` and `AssistantMessage`, which removed every link to a generated file instead of resolving it.

- `AssistantMessage` renders the tool calls and the text in separate `MessageParts`, so the text never saw the files of the message's `code_execution` and `office_documents` calls and every `sandbox:`, `file:`, `attachment:` and `/mnt/` link lost its target. It now resolves the text against the files of the whole message.
- New `generatedFiles` prop on `MessageParts`: the files `resolveFileLinks` matches against, instead of the ones in the tool calls of `message`. `AssistantMessage` uses it; you rarely need to set it. `MessageParts` used on its own behaves as before, and `resolveFileLinks={false}` still turns the resolution off everywhere.
