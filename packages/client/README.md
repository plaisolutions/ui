# @plai/client

Framework-agnostic SDK for Plai SSE chat sessions.

## Install

```bash
pnpm add @plai/client
```

## Usage

```ts
import { PlaiChat, PlaiThreadTransport } from "@plai/client";

const chat = new PlaiChat({
  transport: new PlaiThreadTransport({
    api: "https://api.plaisolutions.com",
    chatSessionId: "session_123",
    threadId: "thread_456",
    headers: async () => ({
      Authorization: `Bearer ${await getToken()}`,
    }),
  }),
});

chat.subscribe((state) => {
  console.log(state.status, state.messages, state.usage, state.error);
});

await chat.sendMessage({
  text: "Summarize this conversation",
  enabledTools: ["some_tool_id"],
  documents: [
    { url: "https://example.com/manual.pdf", filename: "manual.pdf" },
  ],
});
```

## Key Behaviors

- `sendMessage` throws if called while streaming.
- `stop()` aborts in-flight streaming and sets status back to `ready`.
- `usage` is exposed both in top-level state and assistant message metadata.
- guardrails are represented as separate message parts.
- backend `message_id` is stored as `metadata.persistedMessageId`.
