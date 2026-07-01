# React Chat Example

Interactive demo for `[@plaisolutions/react](../../packages/react)`. Creates a chat session via the Plai API, persists it in `localStorage`, and drives a small chat UI with the `useChat` hook and `PlaiThreadTransport`.

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

```tsx
import { useMemo, useState } from "react";
import { PlaiThreadTransport } from "@plaisolutions/client";
import { useChat } from "@plaisolutions/react";

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

await sendMessage({ text: "Hello" });
```



## Setup

1. Enter your project bearer token, agent ID, and external ref.
2. Click **Create session** — calls `POST /chat_sessions`.
3. Chat using the returned `chat_token` (not the project token).

See `[docs/openapi.json](../../docs/openapi.json)` for API details.