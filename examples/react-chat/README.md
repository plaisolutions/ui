# React Chat Example

Interactive demo for `[@plaisolutions/react](../../packages/react)`. Creates a chat session via the Plai API, persists it in `localStorage`, and drives chat state with `useChat` (source of truth) plus optional UI primitives.

## Run

From the monorepo root:

```bash
pnpm install
pnpm --filter @plaisolutions/client build
pnpm --filter @plaisolutions/react build
pnpm --filter react-chat dev
```

Or from this directory:

```bash
pnpm dev
```

## What it demonstrates

When the configured agent invokes `perplexity` or `firecrawl_search`, the
streamed result is rendered by `ToolResultWebSearchCard` through `Message` and
`ToolResultCard`. The application contains no mock tool results.

```tsx
import { useMemo, useState } from "react";
import { PlaiThreadTransport } from "@plaisolutions/client";
import { Message, PromptForm, useChat } from "@plaisolutions/react";

const transport = useMemo(
  () =>
    new PlaiThreadTransport({
      api: "https://api.plaisolutions.com",
      chatSessionId: session.id,
      threadId: session.thread_id,
      headers: { Authorization: `Bearer ${session.chat_token}` },
    }),
  [session.id, session.thread_id, session.chat_token],
);

const { messages, status, error, sendMessage, stop } = useChat({ transport });

return (
  <>
    {messages.map((message) => (
      <Message
        key={message.id}
        message={message}
        datasourceToolResultsPosition="before-content"
      />
    ))}
    <PromptForm
      value={input}
      onValueChange={setInput}
      onSubmit={sendMessage}
      status={status}
      onStop={stop}
    />
  </>
);
```



## Setup

1. Enter your project bearer token, agent ID, and external ref.
2. Click **Create session** — calls `POST /chat_sessions`.
3. Chat using the returned `chat_token` (not the project token).

See `[docs/openapi.json](../../docs/openapi.json)` for API details.
