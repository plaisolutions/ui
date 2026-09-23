# React Chat Example

Interactive demo for `[@plaisolutions/react](../../packages/react)`. Creates a chat session via the Plai API, persists it in `localStorage`, and drives chat state with `useChat` (source of truth) plus optional UI primitives.

The chat screen mirrors the focused central chat pane used in the Plai
dashboard while remaining a plain Vite + React application. It includes the
dashboard message layout, avatar-free tool rows, one assistant avatar per turn,
Markdown rendering, response actions, file uploads, voice input, current-thread
hydration, Agent Memory proposal wiring, composer gradient, and disclaimer.

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
streamed result is rendered by `ToolResultWebSearchCard` through
`AssistantMessage` and `MessageParts`. Provider-supplied `thinking` summaries
are rendered automatically; the application contains no mock tool results or
private reasoning data.

```tsx
import { useMemo, useState } from "react";
import { PlaiThreadTransport } from "@plaisolutions/client";
import {
  Message,
  MessageAvatar,
  PromptForm,
  useChat,
} from "@plaisolutions/react";

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

const {
  messages,
  status,
  error,
  sendMessage,
  getMemoryProposal,
  acceptMemoryProposal,
  rejectMemoryProposal,
  stop,
} = useChat({ transport });

const memoryProposal = {
  activeAgentId: session.agent_id,
  actions: {
    getMemoryProposal,
    acceptMemoryProposal,
    rejectMemoryProposal,
  },
};

return (
  <>
    {messages.map((message) => (
      <Message
        key={message.id}
        message={message}
        avatar={
          message.role === "assistant" ? (
            <MessageAvatar src={agent.avatar} fallback="AI" />
          ) : undefined
        }
        messagePartsProps={{
          thinkingLabel: "Pensando…",
          completedThinkingLabel: "Resumen del razonamiento",
          memoryProposal,
        }}
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

See [docs/openapi.json](../../docs/openapi.json) for API details.

The demo wires Agent Memory proposal cards to the same ChatSession token used
for messages. The default setup creates an external-ref session, which the
current Agent Memories MVP intentionally excludes, so that setup will not emit
proposals. The wiring becomes active when the example is supplied an eligible
user-backed ChatSession.
