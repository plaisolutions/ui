# @plaisolutions/react

React hooks for Plai chat, powered by `@plaisolutions/client`.

`useChat` is the main API. Optional UI primitives are also exported for teams
that don't want to build chat UI from scratch.

## Install

```bash
pnpm add @plaisolutions/client @plaisolutions/react
```

## Usage

```tsx
import { useState } from "react";
import { PlaiThreadTransport } from "@plaisolutions/client";
import { useChat } from "@plaisolutions/react";

const transport = new PlaiThreadTransport({
  api: "/api",
  chatSessionId: "session_123",
  threadId: "thread_456",
});

export function Chat() {
  const [input, setInput] = useState("");
  const { messages, status, error, usage, sendMessage, stop, reset } = useChat({
    transport,
  });

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          <strong>{message.role}</strong>
          {message.parts.map((part, index) => {
            if (part.type === "text")
              return <span key={index}>{part.text}</span>;
            if (part.type === "tool-call")
              return (
                <pre key={index}>
                  {part.name}: {part.state}
                </pre>
              );
            return <em key={index}>{part.content}</em>;
          })}
        </div>
      ))}

      {error && <div>{error.message}</div>}
      {usage && (
        <div>
          Input: {usage.inputTokens} / Output: {usage.outputTokens}
        </div>
      )}

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!input.trim()) return;
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
        <button type="button" onClick={reset}>
          Reset
        </button>
      </form>
    </div>
  );
}
```

## Optional UI Primitives

```tsx
import { Message, PromptForm, ToolResultCard } from "@plaisolutions/react";
```

Available optional components:

- `Message`
- `PromptForm`
- `ToolResultCard`
