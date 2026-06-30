# Software Specification: `@plai/client` and `@plai/react`

## 1. Purpose

This document defines the proposed architecture, package boundaries, public APIs, internal modules, and implementation plan for two npm packages:

- `@plai/client`
- `@plai/react`

The goal is to provide a developer-friendly SDK for building custom user interfaces on top of Plai's AI agent REST API, including endpoints that return Server-Sent Events (SSE).

The desired developer experience is similar in spirit to the UI layer of the Vercel AI SDK: developers should be able to obtain a list of messages, send a new message, observe the current streaming status, stop an in-flight response, and render the UI however they want.

However, Plai should not be React-only. The SDK must be designed so that the core streaming and state management logic can be used from vanilla JavaScript, React, and potentially other frameworks in the future.

For that reason, the implementation will be split into two separate packages inside a single monorepo:

```txt
packages/
  client/
    package.json
    src/

  react/
    package.json
    src/

examples/
  vanilla-chat/
  react-chat/
  nextjs-chat/
```

`@plai/client` will contain the framework-agnostic protocol and state management layer.

`@plai/react` will contain React-specific hooks built on top of `@plai/client`.

No prebuilt UI components are included in the scope of this document.

---

## 2. Goals

### 2.1 Product Goals

The SDK should allow technical users of the Plai platform to build their own chat, assistant, and agent interfaces without having to manually implement SSE parsing, streaming state, tool call tracking, message reconstruction, error handling, or usage tracking.

Developers should be able to create a fully custom UI while relying on the SDK for the complex protocol logic.

### 2.2 Technical Goals

The SDK should:

1. Support Plai's SSE protocol.
2. Support streaming assistant messages.
3. Support text blocks, tool calls, tool results, guardrail blocks, usage events, message IDs, errors, and stream termination.
4. Expose a framework-agnostic client usable from vanilla JavaScript.
5. Expose React hooks that wrap the core client.
6. Avoid coupling the core package to React or any other UI framework.
7. Provide strong TypeScript types for all public APIs.
8. Support request cancellation using `AbortController`.
9. Provide a stable public message model for UI rendering.
10. Provide clear package boundaries so future packages such as Vue, Svelte, or prebuilt UI components can be added without redesigning the core.

---

## 3. Non-Goals

The first version of the SDK will not include:

1. Prebuilt chat UI components.
2. Styling, CSS, Tailwind, Radix, shadcn-style components, or design system primitives.
3. Server-side SDK functionality for creating agents or managing backend resources.
4. Support for non-SSE transports such as WebSockets.
5. Automatic persistence outside of the Plai backend.
6. Offline-first local storage.
7. Framework-specific packages other than React.
8. Node.js-only features that would prevent the SDK from running in modern browsers.

---

## 4. Package Strategy

### 4.1 Monorepo Structure

The two packages should live in the same monorepo. This allows both packages to be developed, tested, versioned, and released together while maintaining separate npm package boundaries.

Recommended structure:

```txt
plai-js/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  turbo.json

  packages/
    client/
      package.json
      tsconfig.json
      src/
        index.ts

    react/
      package.json
      tsconfig.json
      src/
        index.ts

  examples/
    vanilla-chat/
    react-chat/
    nextjs-chat/

  tests/
    fixtures/
      simple-text.sse
      tool-use.sse
      guardrail-input.sse
      guardrail-output.sse
      error-mid-stream.sse
```

Recommended tooling:

- Package manager: `pnpm`
- Monorepo task runner: `turbo`
- Language: TypeScript
- Test runner: Vitest
- Build tool: `tsup` or `unbuild`
- Linting/formatting: ESLint or Biome
- Release management: Changesets

### 4.2 Package Dependencies

`@plai/client` should have zero runtime dependencies if possible.

`@plai/react` should depend on:

```json
{
  "dependencies": {
    "@plai/client": "workspace:*"
  },
  "peerDependencies": {
    "react": ">=18"
  }
}
```

React should be a peer dependency, not a bundled dependency.

---

## 5. Package Responsibilities

## 5.1 `@plai/client`

`@plai/client` is the framework-agnostic package.

It is responsible for:

1. Defining the TypeScript types for Plai SSE events.
2. Parsing SSE streams returned by Plai API endpoints.
3. Providing transport abstractions for invoking streaming endpoints.
4. Reconstructing assistant messages from streaming events.
5. Managing chat state.
6. Exposing an observable client API that works from vanilla JavaScript.
7. Handling `AbortController` cancellation.
8. Tracking status, errors, tool calls, guardrails, usage, and persisted message IDs.

It must not import React or any framework-specific dependency.

## 5.2 `@plai/react`

`@plai/react` is the React adapter package.

It is responsible for:

1. Providing React hooks such as `useChat`.
2. Creating and managing instances of `PlaiChat` from `@plai/client`.
3. Subscribing to state changes and updating React state.
4. Handling React lifecycle concerns such as cleanup on unmount.
5. Exposing a simple React-friendly API similar to:

```ts
const { messages, sendMessage, status, error, stop, reset } = useChat({
  transport,
});
```

It must not duplicate the SSE parser, transport logic, or reducer logic from `@plai/client`.

---

## 6. SSE Protocol Overview

The current Plai endpoint streams responses using SSE.

The relevant endpoint is:

```txt
POST /chat_sessions/{chat_session_id}/threads/{thread_id}/invoke
Content-Type: text/event-stream
```

The stream can emit the following events:

```txt
message_start
content_block_start
content_block_delta
content_block_stop
tool_result
message_id
usage
message_stop
error
```

The client must process events sequentially as they arrive. It should update UI state incrementally without waiting for the full response.

Important protocol rules:

1. `message_start` is the first event.
2. `content_block_start` opens a content block.
3. `content_block_delta` streams text chunks for text blocks.
4. `content_block_stop` closes a content block.
5. Tool use and guardrail blocks do not emit deltas.
6. `tool_result` events should be matched to previous tool calls by tool use ID.
7. `message_id` is emitted after the message is stored in the database, when applicable.
8. `usage` is emitted near the end of the stream.
9. `message_stop` is the final event on both success and error.
10. `error` is followed by `message_stop`.

The client should treat the SSE protocol as a low-level transport format. Application developers should usually render normalized `UIMessage` objects rather than raw SSE events.

---

## 7. Public Message Model

The SDK should expose a stable UI-oriented message model that is easier to render than raw SSE events.

Recommended model:

```ts
export type UIMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: UIMessagePart[];
  metadata?: UIMessageMetadata;
};

export type UIMessageMetadata = {
  model?: string;
  persistedMessageId?: string;
  usage?: Usage;
  createdAt?: Date;
};

export type UIMessagePart = UITextPart | UIToolCallPart | UIGuardrailPart;

export type UITextPart = {
  type: "text";
  text: string;
};

export type UIToolCallPart = {
  type: "tool-call";
  id: string;
  name: string;
  toolType?: string | null;
  input: unknown;
  inputSchema?: unknown;
  state: "pending" | "completed" | "error";
  result?: unknown;
  errorDetails?: string | null;
  metadata?: Record<string, unknown>;
};

export type UIGuardrailPart = {
  type: "guardrail";
  content: string;
};

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number | null;
};
```

The goal is that a UI developer can render messages like this:

```tsx
{
  messages.map((message) => (
    <div key={message.id}>
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          return <span key={index}>{part.text}</span>;
        }

        if (part.type === "tool-call") {
          return (
            <pre key={index}>
              {part.name}: {part.state}
            </pre>
          );
        }

        if (part.type === "guardrail") {
          return <div key={index}>{part.content}</div>;
        }

        return null;
      })}
    </div>
  ));
}
```

---

## 8. `@plai/client` Design

## 8.1 Public API

The initial public API should include:

```ts
export class PlaiChat {
  constructor(options: PlaiChatOptions);

  getState(): ChatState;

  subscribe(listener: ChatStateListener): () => void;

  sendMessage(input: SendMessageInput): Promise<void>;

  stop(): void;

  reset(): void;
}
```

Supporting types:

```ts
export type ChatState = {
  messages: UIMessage[];
  status: ChatStatus;
  error: PlaiChatError | null;
  usage: Usage | null;
};

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export type ChatStateListener = (state: ChatState) => void;

export type SendMessageInput = {
  text: string;
  metadata?: Record<string, unknown>;
};

export type PlaiChatOptions = {
  transport: ChatTransport;
  initialMessages?: UIMessage[];
  generateId?: () => string;
  onEvent?: (event: PlaiSseEvent) => void;
  onError?: (error: PlaiChatError) => void;
};
```

### Status Semantics

`ready` means no request is currently in progress and the user can submit a new message.

`submitted` means the user message has been submitted and the request has started, but no assistant content has streamed yet.

`streaming` means assistant content or structured events are currently being received.

`error` means the last request failed. The client should still allow recovery, for example by calling `sendMessage` again or `reset`.

---

## 8.2 Transport Interface

The core package should define a transport interface:

```ts
export interface ChatTransport {
  stream(request: ChatTransportRequest): AsyncIterable<PlaiSseEvent>;
}

export type ChatTransportRequest = {
  messages: UIMessage[];
  message: SendMessageInput;
  signal: AbortSignal;
};
```

This abstraction allows different transports in the future without changing `PlaiChat`.

The first concrete implementation should be `PlaiThreadTransport`.

```ts
export class PlaiThreadTransport implements ChatTransport {
  constructor(options: PlaiThreadTransportOptions);

  stream(request: ChatTransportRequest): AsyncIterable<PlaiSseEvent>;
}
```

Recommended options:

```ts
export type PlaiThreadTransportOptions = {
  api: string;
  chatSessionId?: string;
  threadId?: string;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  credentials?: RequestCredentials;
  body?: (request: ChatTransportRequest) => unknown;
  fetch?: typeof fetch;
};
```

The `api` option should support either:

1. A full endpoint URL.
2. A base API URL plus `chatSessionId` and `threadId`.

Example:

```ts
const transport = new PlaiThreadTransport({
  api:
    "https://api.plaisolutions.com/chat_sessions/session_123/threads/thread_456/invoke",
  headers: async () => ({
    Authorization: `Bearer ${await getToken()}`,
  }),
});
```

Alternative:

```ts
const transport = new PlaiThreadTransport({
  api: "https://api.plaisolutions.com",
  chatSessionId: "session_123",
  threadId: "thread_456",
});
```

The transport should use `fetch` with `POST` and read the response body as a stream.

It should not use `EventSource` as the primary implementation because the endpoint requires `POST` and likely needs request bodies, headers, and authentication.

---

## 8.3 SSE Parser

The client package should expose a parser that converts a `ReadableStream<Uint8Array>` into typed `PlaiSseEvent` objects.

Recommended internal API:

```ts
export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<PlaiSseEvent>;
```

The parser should:

1. Decode byte chunks using `TextDecoder`.
2. Buffer incomplete SSE frames.
3. Split complete events by blank lines.
4. Extract `event:` and `data:` lines.
5. Parse JSON data.
6. Validate the `type` field where possible.
7. Yield typed events.
8. Throw a protocol error for invalid JSON or invalid event structure.

The parser should support multiline `data:` fields even if the first backend version always sends JSON in a single data line.

---

## 8.4 Event Reducer

The event reducer is responsible for converting raw SSE events into `ChatState`.

Recommended internal API:

```ts
export function reduceChatState(
  state: ChatState,
  event: PlaiSseEvent,
): ChatState;
```

The reducer should be pure and covered by tests.

Responsibilities:

### `message_start`

Create a new assistant message:

```ts
{
  id: event.message.id,
  role: 'assistant',
  parts: [],
  metadata: {
    model: event.message.model,
    createdAt: new Date(),
  },
}
```

Set status to `streaming`.

### `content_block_start` with `text`

Append a text part to the current assistant message:

```ts
{
  type: 'text',
  text: '',
}
```

Track the relationship between `content_block.index` and the message part position.

### `content_block_delta`

Find the active text part by block index and append `delta.text`.

The reducer must support many small deltas, including deltas containing newlines.

### `content_block_start` with `tool_use`

Append a tool call part:

```ts
{
  type: 'tool-call',
  id: contentBlock.id,
  name: contentBlock.name,
  toolType: contentBlock.tool_type,
  input: contentBlock.input,
  inputSchema: contentBlock.input_schema,
  state: 'pending',
}
```

### `tool_result`

Find the matching `tool-call` part by `tool_use_id`.

If `is_error` is false, set:

```ts
state: "completed";
result: event.content;
metadata: event.metadata;
```

If `is_error` is true, set:

```ts
state: "error";
result: event.content;
errorDetails: event.error_details;
metadata: event.metadata;
```

### `content_block_start` with `guardrail`

Append a guardrail part:

```ts
{
  type: 'guardrail',
  content: contentBlock.content,
}
```

### `message_id`

Update the current assistant message metadata:

```ts
metadata.persistedMessageId = event.message_id;
```

### `usage`

Update both top-level state and current assistant message metadata:

```ts
state.usage = {
  inputTokens: event.input_tokens,
  outputTokens: event.output_tokens,
  cachedTokens: event.cached_tokens,
};
```

### `error`

Set `state.error` and `state.status = 'error'`.

The client should keep partial assistant content already received before the error.

### `message_stop`

If no error occurred, set `status = 'ready'`.

If an error occurred, keep `status = 'error'`.

---

## 8.5 Internal State Tracking

The reducer may need internal metadata not exposed to UI consumers.

Recommended internal state:

```ts
export type InternalChatState = ChatState & {
  activeAssistantMessageId?: string;
  blockIndexToPartIndex: Record<number, number>;
  toolUseIdToPartIndex: Record<string, number>;
};
```

The public `getState()` method should return only the public `ChatState`, not reducer internals.

---

## 8.6 Error Model

Define a normalized SDK error type:

```ts
export type PlaiChatError = {
  type:
    | "context_length_exceeded"
    | "llm_error"
    | "http_error"
    | "internal_error"
    | "network_error"
    | "abort_error"
    | "protocol_error";
  message: string;
  cause?: unknown;
};
```

Errors emitted by the SSE stream should be mapped directly.

Network errors, invalid HTTP responses, invalid JSON, parser errors, or unexpected protocol states should be normalized into SDK errors.

Cancellation via `stop()` should not necessarily set `status = 'error'`. The recommended behavior is:

1. Abort the request.
2. Keep partial content.
3. Set `status = 'ready'`.
4. Optionally expose a flag in the future if the UI needs to know that the response was stopped.

---

## 8.7 `PlaiChat.sendMessage()` Flow

Recommended sequence:

1. Reject or no-op if `status` is not `ready`, unless future options allow concurrent sends.
2. Create a local user message.
3. Append user message to state.
4. Set status to `submitted`.
5. Create `AbortController`.
6. Call `transport.stream(...)`.
7. For every SSE event:

- call `onEvent`, if provided;
- reduce state;
- notify subscribers.

8. On successful `message_stop`, set status to `ready`.
9. On SSE `error`, keep partial content and set error state.
10. On network/parser exceptions, normalize error and update state.
11. Always clean up the active abort controller.

Example implementation shape:

```ts
async sendMessage(input: SendMessageInput): Promise<void> {
  if (this.state.status !== 'ready') {
    throw new Error('Cannot send a message while another response is in progress.');
  }

  const userMessage = createUserMessage(input, this.options.generateId);
  this.setState(appendUserMessage(this.state, userMessage));
  this.setState({ ...this.state, status: 'submitted', error: null });

  const controller = new AbortController();
  this.abortController = controller;

  try {
    for await (const event of this.transport.stream({
      messages: this.state.messages,
      message: input,
      signal: controller.signal,
    })) {
      this.options.onEvent?.(event);
      this.setState(reduceChatState(this.state, event));
    }
  } catch (error) {
    this.handleError(normalizeError(error));
  } finally {
    this.abortController = null;
  }
}
```

---

## 9. `@plai/react` Design

## 9.1 Public API

The first React hook should be `useChat`.

```ts
export function useChat(options: UseChatOptions): UseChatResult;
```

Recommended types:

```ts
export type UseChatOptions = {
  transport: ChatTransport;
  initialMessages?: UIMessage[];
  generateId?: () => string;
  onEvent?: (event: PlaiSseEvent) => void;
  onError?: (error: PlaiChatError) => void;
};

export type UseChatResult = {
  messages: UIMessage[];
  status: ChatStatus;
  error: PlaiChatError | null;
  usage: Usage | null;
  sendMessage: (input: SendMessageInput) => Promise<void>;
  stop: () => void;
  reset: () => void;
};
```

Example usage:

```tsx
"use client";

import { useState } from "react";
import { useChat } from "@plai/react";
import { PlaiThreadTransport } from "@plai/client";

const transport = new PlaiThreadTransport({
  api: "/chat_sessions/session_123/threads/thread_456/invoke",
});

export function ChatPage() {
  const { messages, sendMessage, status, error, stop } = useChat({
    transport,
  });

  const [input, setInput] = useState("");

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          <strong>{message.role}</strong>

          {message.parts.map((part, index) => {
            if (part.type === "text") {
              return <span key={index}>{part.text}</span>;
            }

            if (part.type === "tool-call") {
              return (
                <pre key={index}>
                  Tool: {part.name} - {part.state}
                </pre>
              );
            }

            if (part.type === "guardrail") {
              return <div key={index}>{part.content}</div>;
            }

            return null;
          })}
        </div>
      ))}

      {error && <div>{error.message}</div>}

      <form
        onSubmit={async (event) => {
          event.preventDefault();

          if (!input.trim()) {
            return;
          }

          await sendMessage({ text: input });
          setInput("");
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={status !== "ready"}
        />

        {status === "streaming" ? (
          <button type="button" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={status !== "ready"}>
            Send
          </button>
        )}
      </form>
    </div>
  );
}
```

---

## 9.2 Hook Implementation

`useChat` should internally create a `PlaiChat` instance and subscribe to it.

Recommended implementation approach:

```ts
export function useChat(options: UseChatOptions): UseChatResult {
  const chatRef = useRef<PlaiChat | null>(null);

  if (chatRef.current === null) {
    chatRef.current = new PlaiChat(options);
  }

  const [state, setState] = useState(() => chatRef.current!.getState());

  useEffect(() => {
    const chat = chatRef.current!;
    return chat.subscribe(setState);
  }, []);

  useEffect(() => {
    return () => {
      chatRef.current?.stop();
    };
  }, []);

  return {
    messages: state.messages,
    status: state.status,
    error: state.error,
    usage: state.usage,
    sendMessage: chatRef.current.sendMessage.bind(chatRef.current),
    stop: chatRef.current.stop.bind(chatRef.current),
    reset: chatRef.current.reset.bind(chatRef.current),
  };
}
```

The final implementation should be careful about stale closures and option changes. The first version can document that transport instances should be stable, preferably memoized by the consumer.

Example:

```tsx
const transport = useMemo(() => {
  return new PlaiThreadTransport({ api });
}, [api]);
```

---

## 10. Vanilla JavaScript Usage

The purpose of `@plai/client` is to support framework-agnostic usage.

Example:

```ts
import { PlaiChat, PlaiThreadTransport } from "@plai/client";

const chat = new PlaiChat({
  transport: new PlaiThreadTransport({
    api: "/chat_sessions/session_123/threads/thread_456/invoke",
  }),
});

const unsubscribe = chat.subscribe((state) => {
  const container = document.querySelector("#messages");

  if (!container) {
    return;
  }

  container.innerHTML = state.messages
    .map((message) => {
      const text = message.parts
        .map((part) => {
          if (part.type === "text") return part.text;
          if (part.type === "guardrail") return part.content;
          if (part.type === "tool-call")
            return `[Tool: ${part.name} - ${part.state}]`;
          return "";
        })
        .join("");

      return `<p><strong>${message.role}:</strong> ${text}</p>`;
    })
    .join("");
});

document.querySelector("form")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const input = document.querySelector<HTMLInputElement>("#message-input");

  if (!input || !input.value.trim()) {
    return;
  }

  await chat.sendMessage({ text: input.value });
  input.value = "";
});
```

---

## 11. Build and Packaging Requirements

Both packages should publish ESM-first builds.

Recommended `package.json` for `@plai/client`:

```json
{
  "name": "@plai/client",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"]
}
```

Recommended `package.json` for `@plai/react`:

```json
{
  "name": "@plai/react",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "peerDependencies": {
    "react": ">=18"
  },
  "dependencies": {
    "@plai/client": "^0.1.0"
  },
  "files": ["dist"]
}
```

If CommonJS compatibility is required later, it can be added through dual package exports, but the first version should stay ESM-first unless there is a strong compatibility requirement.

---

## 12. Testing Strategy

### 12.1 Unit Tests for SSE Parser

Use fixture files containing raw SSE streams.

Required fixtures:

1. Simple text response.
2. Response with tool use.
3. Input guardrail response.
4. Output guardrail response.
5. Error during streaming.
6. Invalid JSON.
7. Incomplete chunks split across arbitrary boundaries.
8. Multiline `data:` event.

Assertions:

- The parser yields the expected event sequence.
- The parser handles arbitrary chunk boundaries.
- The parser throws a protocol error for invalid JSON.
- The parser ignores empty keep-alive frames if they are introduced later.

### 12.2 Unit Tests for Reducer

Each event type should have dedicated reducer tests.

Required assertions:

- `message_start` creates an assistant message.
- Text deltas are accumulated in the correct block.
- Tool calls are added as pending parts.
- Tool results update the correct tool call by ID.
- Guardrail blocks are represented as guardrail parts.
- Usage is attached to state and message metadata.
- Message IDs update persisted message metadata.
- Errors preserve partial content.
- `message_stop` sets the final status correctly.

### 12.3 Integration Tests for `PlaiChat`

Use a fake transport that returns an async iterable of events.

Test cases:

1. Sending a message appends a user message.
2. Assistant message streams incrementally.
3. Subscribers are notified on each state update.
4. `stop()` aborts an in-flight request.
5. Errors are normalized.
6. State can be reset.

### 12.4 React Hook Tests

Use a React testing utility to validate:

1. `useChat` returns initial state.
2. `sendMessage` updates messages.
3. Streaming updates trigger re-render.
4. Cleanup calls `stop()` on unmount.
5. Errors are exposed to the component.

---

## 13. Documentation Requirements

The initial documentation should include:

1. Installation.
2. Basic React usage.
3. Basic vanilla JavaScript usage.
4. How to configure `PlaiThreadTransport`.
5. How to pass auth headers.
6. How to render message parts.
7. How to render tool calls.
8. How to render guardrails.
9. How to read usage information.
10. How to handle errors.
11. How to stop an in-flight response.
12. Explanation of package boundaries.

Example installation:

```bash
pnpm add @plai/client @plai/react
```

For vanilla usage:

```bash
pnpm add @plai/client
```

---

## 14. Implementation Roadmap

### Phase 1: Repository Setup

1. Create pnpm monorepo.
2. Add `packages/client` and `packages/react`.
3. Configure TypeScript base config.
4. Configure build system.
5. Configure test runner.
6. Configure linting and formatting.

### Phase 2: Protocol Types

1. Define all SSE event types.
2. Define UI message types.
3. Define usage, error, transport, and state types.
4. Export public types from `@plai/client`.

### Phase 3: SSE Parser

1. Implement `parseSseStream`.
2. Add fixtures.
3. Add parser unit tests.

### Phase 4: State Reducer

1. Implement `reduceChatState`.
2. Add tests for every event type.
3. Validate tool call matching.
4. Validate guardrail handling.
5. Validate usage and error handling.

### Phase 5: Transport

1. Implement `ChatTransport` interface.
2. Implement `PlaiThreadTransport`.
3. Support dynamic headers.
4. Support request body customization.
5. Support request cancellation.
6. Add integration tests with mocked fetch streams.

### Phase 6: `PlaiChat`

1. Implement observable state store.
2. Implement `sendMessage`.
3. Implement `stop`.
4. Implement `reset`.
5. Add integration tests.

### Phase 7: React Hook

1. Implement `useChat`.
2. Add hook tests.
3. Add React example app.
4. Add Next.js example app.

### Phase 8: Documentation and Release

1. Write package READMEs.
2. Add API reference.
3. Add examples.
4. Configure Changesets.
5. Publish initial `0.1.0` versions.

---

## 15. Open Questions

The development team should clarify the following before finalizing the first implementation:

1. What exact request body does the invoke endpoint expect when sending a user message?
2. Should the SDK send only the latest message or the full local message history?
3. Should local optimistic user messages use client-generated IDs or IDs returned by the backend?
4. Should `message_id` replace the temporary assistant message ID, or should it be stored as `metadata.persistedMessageId`?
5. Should `stop()` notify the backend or only abort the client request?
6. Should `sendMessage` throw when called while streaming, or should it automatically stop the current response?
7. Should the SDK expose raw SSE events to consumers for analytics/debugging?
8. Should usage be accumulated globally in the chat state or only stored per assistant message?
9. Should guardrail content replace previous text, or always be rendered as a separate part?
10. Should tool result `content` be treated as plain text, JSON, or unknown?

Recommended initial decisions:

1. Store backend `message_id` as `metadata.persistedMessageId` instead of replacing the streaming message ID.
2. Keep partial assistant content on errors.
3. Treat tool result content as `unknown` or `string | unknown`, depending on backend guarantees.
4. Expose `onEvent` for debugging and advanced users.
5. Keep `@plai/react` headless and UI-free.

---

## 16. Acceptance Criteria

The first version is complete when:

1. `@plai/client` can send a message to the invoke endpoint and process the SSE response.
2. `@plai/client` can be used from vanilla JavaScript without React.
3. `@plai/react` exposes a working `useChat` hook.
4. The hook exposes `messages`, `status`, `error`, `usage`, `sendMessage`, `stop`, and `reset`.
5. Streaming text updates incrementally.
6. Tool calls and tool results are represented in message parts.
7. Guardrail blocks are represented in message parts.
8. Usage events are exposed to the consumer.
9. SSE errors are exposed without losing partial content.
10. `message_stop` finalizes the stream correctly.
11. Tests cover parser, reducer, transport, client, and React hook behavior.
12. The packages build successfully and generate TypeScript declaration files.
13. Example apps demonstrate vanilla and React usage.

---

## 17. Summary

The SDK should be implemented as two separate npm packages inside one monorepo:

```txt
@plai/client
@plai/react
```

`@plai/client` is the core package. It owns the SSE protocol, transport, parser, reducer, normalized message model, observable state, and framework-agnostic `PlaiChat` class.

`@plai/react` is a thin React adapter. It owns hooks such as `useChat`, but delegates protocol and state logic to `@plai/client`.

This design gives Plai a clean foundation for custom UI development today while keeping the door open for future framework adapters and optional UI packages later.
