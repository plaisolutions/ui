# @plaisolutions/client

Framework-agnostic SDK for Plai SSE chat sessions.

## Install

```bash
pnpm add @plaisolutions/client
```

## Usage

```ts
import { PlaiChat, PlaiThreadTransport } from "@plaisolutions/client";

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

## PlaiChat API

`PlaiChat` exposes these public methods:

- `getState(): ChatState`
  Returns the current snapshot.
- `subscribe(listener): () => void`
  Registers a listener and returns `unsubscribe`.
- `sendMessage(input): Promise<void>`
  Sends a user message and starts streaming the assistant response.
- `stop(): void`
  Aborts the current stream (if any) and returns to `ready`.
- `reset(): void`
  Calls `stop()` and restores the initial state (`initialMessages`, empty error/usage).

## `subscribe` State Shape

Your listener receives a `state` object with this shape:

```js
{
  messages: UIMessage[],
  status: "ready" | "submitted" | "streaming" | "error",
  error: PlaiChatError | null,
  usage: Usage | null
}
```

### `state.status` (`ChatStatus`)

- `ready`: idle, ready to send.
- `submitted`: user message was queued and request is starting.
- `streaming`: SSE response is in progress.
- `error`: stream failed; details are in `state.error`.

### `state.error` (`PlaiChatError`)

```js
{
  type:
    "context_length_exceeded" |
    "llm_error" |
    "http_error" |
    "internal_error" |
    "network_error" |
    "abort_error" |
    "protocol_error",
  message: string,
  cause?: unknown
}
```

- `abort_error` is raised internally when aborted, but `stop()` resets state back to `ready` with `error: null`.
- `http_error` message includes status/body details when available.

### `state.usage` (`Usage`)

```js
{
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number | null
}
```

`usage` is also copied to the assistant message metadata when emitted by the backend.

## `UIMessage` Shape

Each item in `state.messages`:

```js
{
  id: string,
  role: "user" | "assistant" | "system",
  parts: UIMessagePart[],
  metadata?: UIMessageMetadata
}
```

### `UIMessage.parts` (`UIMessagePart[]`)

Text part:

```js
{ type: "text", text: string }
```

Tool call part:

```js
{
  type: "tool-call",
  id: string,
  name: string,
  toolType?: string | null,
  input: unknown,
  inputSchema?: unknown,
  state: "pending" | "completed" | "error",
  result?: unknown,
  errorDetails?: string | null,
  metadata?: Record<string, unknown>
}
```

Guardrail part:

```js
{ type: "guardrail", content: string }
```

### `UIMessage.metadata` (`UIMessageMetadata`)

```js
{
  model?: string,
  persistedMessageId?: string,
  usage?: Usage,
  createdAt?: Date,
  metadata?: Record<string, unknown>
}
```

- `persistedMessageId` is the backend `message_id` event.
- `createdAt` is set on locally created user messages.

## `sendMessage` Input

```js
{
  text: string,
  enabledTools?: string[],
  documents?: Array<{ url: string, filename?: string | null }>,
  metadata?: Record<string, unknown>
}
```

## Tips

- Call `chat.getState()` once on startup to paint initial UI before receiving updates from `subscribe`.
- `sendMessage` throws if called while status is not `ready`.
- Use `onEvent` and `onError` (constructor options) for logging/telemetry hooks.

## Key Behaviors

- `sendMessage` throws if called while streaming.
- `stop()` aborts in-flight streaming and sets status back to `ready`.
- `usage` is exposed both in top-level state and assistant message metadata.
- guardrails are represented as separate message parts.
- backend `message_id` is stored as `metadata.persistedMessageId`.
