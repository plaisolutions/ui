# Vanilla Chat Example

Interactive demo for [`@plai/client`](../../packages/client). Creates a chat session via the Plai API, persists it in `localStorage`, and drives a small chat UI with `PlaiChat` and `PlaiThreadTransport`.

## Run

From the monorepo root:

```bash
pnpm install
pnpm --filter @plai/client build
pnpm --filter vanilla-chat dev
```

Or from this directory:

```bash
pnpm dev
```

## What it demonstrates

```js
import { PlaiChat, PlaiThreadTransport } from "@plai/client";

const chat = new PlaiChat({
  transport: new PlaiThreadTransport({
    api: "https://api.plaisolutions.com",
    chatSessionId: session.id,
    threadId: session.thread_id,
    headers: { Authorization: `Bearer ${session.chat_token}` },
  }),
});

chat.subscribe((state) => {
  // render state.status and state.messages
});

await chat.sendMessage({ text: "Hello" });
```

## Setup

1. Enter your project bearer token, agent ID, and external ref.
2. Click **Create session** — calls `POST /chat_sessions`.
3. Chat using the returned `chat_token` (not the project token).

See [`openapi.json`](./openapi.json) or [`docs/openapi.json`](../../docs/openapi.json) for API details.
