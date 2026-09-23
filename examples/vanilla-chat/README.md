# Vanilla Chat Example

Interactive demo for `[@plaisolutions/client](../../packages/client)`. Creates a chat session via the Plai API, persists it in `localStorage`, and drives a small chat UI with `PlaiChat` and `PlaiThreadTransport`.

## Run

From the monorepo root:

```bash
pnpm install
pnpm --filter @plaisolutions/client build
pnpm --filter vanilla-chat dev
```

Or from this directory:

```bash
pnpm dev
```

## What it demonstrates

```js
import { PlaiChat, PlaiThreadTransport } from "@plaisolutions/client";

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

// When a memory_proposal tool part provides a proposal ID:
const proposal = await chat.getMemoryProposal({ proposalId });
if (proposal.can_resolve) {
  await chat.acceptMemoryProposal({ proposalId });
  // Or: await chat.rejectMemoryProposal({ proposalId });
}
```

Agent Memory proposal actions use the same ChatSession token as
`sendMessage`. This vanilla example displays tool parts as JSON; applications
that need the packaged consent card can use `MemoryProposalCard` from
`@plaisolutions/react`. The client intentionally does not include
administrative memory CRUD APIs.

## Setup

1. Enter your project bearer token, agent ID, and external ref.
2. Click **Create session** — calls `POST /chat_sessions`.
3. Chat using the returned `chat_token` (not the project token).
