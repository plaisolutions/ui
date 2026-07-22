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

await chat.rateMessage({
  messageId: "persisted_message_123",
  rating: "POSITIVE",
});

const transcription = await chat.transcribeAudio(audioBlob);

const mediaFile = await chat.uploadFile(file);
await chat.sendMessage({
  text: "Review this file",
  documents: [{
    mediaFileId: mediaFile.id,
    url: mediaFile.url,
    filename: mediaFile.name,
  }],
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
- `rateMessage(input): Promise<void>`
  Rates a persisted message as `POSITIVE` or `NEGATIVE` in the transport's
  chat session.
- `transcribeAudio(audio, signal?): Promise<string>`
  Transcribes an audio blob using the transport's chat session and
  authentication headers.
- `uploadFile(file, options?): Promise<MediaFile>`
  Uploads a file to the current chat thread and updates `uploadState` with
  byte progress and server-processing status.
- `stop(): void`
  Aborts the current stream (if any) and returns to `ready`.
- `reset(): void`
  Calls `stop()` and restores the initial state (`initialMessages`, empty error/usage).
- `hydrate(messages): void`
  Replaces persisted history while idle, for example after switching threads.
- `clearError(): void`
  Returns an errored chat to `ready` without discarding its messages.

## Persisted thread history

`normalizePlaiThreadMessages(messages)` converts messages returned by PLai thread
and snapshot endpoints (including legacy content blocks, content parts and tool
messages) into `UIMessage[]` for `initialMessages` or `hydrate()`.

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

User image attachment part:

```js
{
  type: "input_image",
  url: string,
  title?: string,
  metadata?: {
    originalFileName?: string,
    sourceUrl?: string,
    wasConverted?: boolean,
    convertedFromExtension?: string
  }
}
```

User document attachment part:

```js
{
  type: "input_file",
  fileUrl: string,
  title?: string,
  mimeType?: string,
  metadata?: {
    originalFileName?: string,
    sourceUrl?: string,
    wasConverted?: boolean,
    convertedFromExtension?: string
  }
}
```

Tool call part:

```js
{
  type: "tool-call",
  id: string,
  name: string,
  // Discriminant. Concrete part types exist per tool:
  // UIAgentInvocationToolCallPart | UIDatasourceToolCallPart | ... | UIUnknownToolCallPart
  toolType?: "unknown" | null | "agent_invocation" | "browser" | "datasource" | "email_send" | "external_datasource" | "firecrawl_search" | "http_request" | "mcp_tool" | "office_documents" | "perplexity" | "structured_datasource" | "workflow_dispatch",
  input: unknown,
  inputSchema?: unknown,
  state: "pending" | "completed" | "error",
  result?: unknown,
  errorDetails?: string | null,
  metadata?: Record<string, unknown> // includes office_documents generated files in metadata.media_files
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

### Attachments vs tool-generated files

- User attachments are represented in `UIMessagePart` as `input_file` / `input_image`.
- Files generated by tools (for example `office_documents`) remain in
  `UIToolCallPart.metadata` (for example `metadata.media_files`) and are **not**
  converted to `UIMessagePart`.

## `sendMessage` Input

```js
{
  text: string,
  enabledTools?: string[],
  documents?: Array<{ url: string, filename?: string | null }>
}
```

When `documents` is present, `PlaiChat` creates user message parts in this order:
documents first, then text (if non-empty). Sending documents without text is supported.

## `rateMessage` Input

```js
{
  messageId: string,
  rating: "POSITIVE" | "NEGATIVE"
}
```

`PlaiThreadTransport` posts this as `{ message_id, rating }` to
`/chat_sessions/{chatSessionId}/rate-message`. It resolves dynamic `headers`
for every rating request, so refreshed session tokens are used automatically.
Non-2xx responses, including `404`, reject with `HttpStatusError`.

## Audio transcription

```ts
const text = await chat.transcribeAudio(audioBlob, abortController.signal);
```

`PlaiThreadTransport` posts the audio as multipart form data to
`/chat_sessions/{chatSessionId}/transcriptions`. It resolves dynamic `headers`
for every request and leaves the multipart boundary to the runtime. The
endpoint's JSON string is returned directly. Non-2xx responses reject with
`HttpStatusError`; an unexpected success body rejects with `ProtocolError`.

## Thread media uploads

```ts
const mediaFile = await chat.uploadFile(file, {
  signal: abortController.signal,
});

await chat.sendMessage({
  text: "Summarize this file",
  documents: [{
    mediaFileId: mediaFile.id,
    url: mediaFile.url,
    filename: mediaFile.name,
  }],
});
```

`PlaiThreadTransport` uploads multipart data to
`/chat_sessions/{chatSessionId}/threads/{threadId}/media-files`. Upload byte
progress is tracked with `XMLHttpRequest`; dynamic authentication headers are
resolved for every file. `url` is retained for the optimistic local preview,
while the invoke request sends `media_file_id` and `filename`.

`chat.getState().uploadState.status` is `idle`, `uploading`, `processing`, or
`error`. It is the only source of truth for upload activity. `stop()` also
aborts the active upload.

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
- `UIMessagePart` now includes `input_file` and `input_image`; if your app uses
  exhaustive `switch` checks, add these new branches.
