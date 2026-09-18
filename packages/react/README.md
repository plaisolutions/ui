# @plaisolutions/react

React hooks for Plai chat, powered by `@plaisolutions/client`.

`useChat` is the main API. Optional UI primitives are also exported for teams
that don't want to build chat UI from scratch.

## Install

```bash
pnpm add @plaisolutions/client @plaisolutions/react
```

Import the component stylesheet once in your application entrypoint. It does
not include a global CSS reset, so it can safely coexist with the host app's
styles:

```tsx
import "@plaisolutions/react/styles.css"
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
import {
  Message,
  MessageRoot,
  AssistantMessage,
  UserMessage,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
  MessageParts,
  Thinking,
  Clipboard,
  Reload,
  ThumbDown,
  ThumbUp,
  PromptForm,
  ToolResultCard,
} from "@plaisolutions/react";
```

Available optional components:

- `Message`
- `MessageRoot`
- `AssistantMessage`
- `UserMessage`
- `MessageAvatar`
- `MessageContent`
- `MessageHeader`
- `MessageFooter`
- `MessageParts`
- `Thinking`
- `Clipboard`
- `Reload`
- `ThumbUp`
- `ThumbDown`
- `PromptForm`
- `ToolResultCard`

For persisted threads, pass a stable `conversationId` when the active thread
changes and use the returned `hydrate(messages)` and `clearError()` APIs.
The returned `rateMessage({ messageId, rating, description? })`,
`resendMessage({ messageId, enabledTools? })`,
`getResourceDownloadUrl({ resourceId, signal? })`,
`transcribeAudio(audio, signal?)`, and `uploadFile(file)` actions reuse the
same session-aware transport and dynamic authentication headers as
`sendMessage`.
`Message` is the recommended renderer for a complete turn. It routes user and
assistant messages to their semantic layout automatically:

```tsx
<Message
  message={message}
  avatar={message.role === "assistant" ? assistantAvatar : undefined}
  footer={message.role === "assistant" ? actions : undefined}
  getResourceDownloadUrl={getResourceDownloadUrl}
  messagePartsProps={{ locale, renderText, renderThinking }}
/>
```

Pass the `getResourceDownloadUrl` action returned by `useChat` to `Message`.
Datasource cards keep public and Google Drive links direct. For stored
resources without a public URL, the card requests a short-lived URL only when
clicked and never renders the protected bucket URL as a link. If the action is
omitted, protected resources remain visible but non-interactive.

`MessageRoot` is the low-level composable row primitive. `MessageAvatar`,
`MessageContent`, `MessageHeader` and `MessageFooter` are optional layout
children, while `MessageParts` renders a `UIMessage` and accepts custom
text/tool renderers. Existing primitive usage through `Message` remains
supported for compatibility.

Use `UserMessage` and `AssistantMessage` as the semantic turn components in a
standard chat. `UserMessage` aligns the user content to the end and accepts the
same `MessageParts` options through `messagePartsProps`:

```tsx
<UserMessage
  message={message}
  messagePartsProps={{ locale, renderText }}
/>
```

Use `AssistantMessage` for a complete assistant turn. It renders tool results
in an avatar-free row and renders the assistant avatar once, beside the
non-tool content. Pass the existing `MessageParts` options through
`messagePartsProps` and message actions through the `footer` slot:

```tsx
<AssistantMessage
  message={message}
  avatar={<MessageAvatar src={avatarUrl} fallback="Assistant" />}
  footer={<MessageFooter>{actions}</MessageFooter>}
  messagePartsProps={{ locale, renderText, renderThinking }}
/>
```

Completed datasource, Perplexity, and Firecrawl results are aggregated by
default before the assistant text. The first three source cards are shown; an
additional `+N sources` card opens a sheet containing the complete result set.
Use `maxVisibleSourceCards` to change the limit,
`sourceToolResultsPosition="inline"` to keep the aggregate at the first source
position, or `sourceToolResultsLayout="individual"` to opt out. The deprecated
`datasourceToolResultsPosition` prop remains available for compatibility.

`MessageParts` automatically renders `thinking` parts streamed by the client.
`Thinking` displays provider-supplied summaries only, never private reasoning
or provider replay metadata. Use its labels, or the corresponding
`thinkingLabel` and `completedThinkingLabel` props on `MessageParts`, to
localize the UI.

Long, text-only user messages can be collapsed. Use `readMoreLabel` and
`readLessLabel` on `MessageParts` to localize that control. The default message
text is right-aligned and medium weight for users, and left-aligned and normal
weight for assistant or system messages; this does not change when a message is
expanded.

```tsx
<Thinking
  part={{
    type: "thinking",
    thinking: "Checking the relevant sources.",
    state: "completed",
  }}
  completedLabel="Thought process"
/>
```

```tsx
<MessageRoot align={message.role === "user" ? "end" : "start"}>
  <MessageAvatar src={avatarUrl} fallback="John Doe" />
  <MessageContent>
    <MessageHeader>John Doe</MessageHeader>
    <MessageParts
      message={message}
      readMoreLabel="Leer más"
      readLessLabel="Leer menos"
    />
    <MessageFooter>Delivered</MessageFooter>
  </MessageContent>
</MessageRoot>
```

`Clipboard` owns the browser clipboard operation and its button feedback. The
optional `onCopy` callback runs after a successful copy:

```tsx
<Clipboard text="Text to copy" />

<Clipboard text="Text to copy" onCopy={(text) => trackCopy(text)} />
```

Rating buttons delegate their click behavior to the host:

```tsx
<ThumbUp
  onClick={() =>
    rateMessage({ messageId: "message_123", rating: "POSITIVE" })
  }
/>
<ThumbDown
  onClick={() =>
    rateMessage({ messageId: "message_123", rating: "NEGATIVE" })
  }
/>
<Reload
  label="Retry response"
  onClick={() =>
    resendMessage({ messageId: "message_123", enabledTools })
  }
/>
```

`resendMessage` appends a new turn using the user text and attachments that
precede the selected assistant response. It does not delete or replace the
original response.

`SpeechToTextToggle` owns recording and UI state while authenticated
transcription remains a transport capability:

```tsx
const { transcribeAudio } = useChat({ transport });
const speechToText = useSpeechToText({
  transcribe: transcribeAudio,
  onTranscriptionComplete: (text) => setInput(text),
});

<SpeechToTextToggle
  controller={speechToText}
  cancelOnClickWhileRecording
/>
```

`speechToText.finish()` stops an active recording and resolves with its
transcription. Concurrent calls share the same promise, so a prompt submit can
safely finish a recording while the microphone control is also processing it.
Pass `hasPendingInput={speechToText.status === "recording" ||
speechToText.status === "transcribing"}` to `PromptForm` to keep its submit
action enabled while voice input is pending.

`transcribe` is required. Storybook and demos can pass the exported
`dummyTranscribeAudio` explicitly.

File uploads expose one reactive `uploadState`; derive activity from its
status rather than maintaining a second boolean:

```tsx
const { uploadFile, uploadState, sendMessage } = useChat({ transport });

<PromptForm
  uploadState={uploadState}
  onSubmit={async ({ text, files }) => {
    const documents = [];
    for (const file of files) {
      const mediaFile = await uploadFile(file);
      documents.push({
        mediaFileId: mediaFile.id,
        url: mediaFile.url,
        filename: mediaFile.name,
      });
    }
    await sendMessage({ text, documents });
  }}
/>
```

`PromptForm` keeps attachment previews visible, disables file interactions
during `uploading` and `processing`, and renders byte progress below them.

Datasource results use localized OpenGraph metadata when it is present. Pass
the active locale to `MessageParts` (for example, `locale="es-ES"`). Resolution
tries the exact locale, then its base language, then the default OpenGraph
value, before falling back to the native resource fields.

The same resolution is available to custom renderers through the exported
`getLocalizedOpenGraphValue`, `getResourceTitle`, `getResourceDescription`,
`getResourceIcon`, `getResourceType`, and `getResourceUrl` helpers.
