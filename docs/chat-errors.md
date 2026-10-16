# Chat errors

`useChat()` keeps failures in `error`; it does not insert synthetic messages into
the conversation. The same error is available to the client's `onError` callback
for HTTP failures. Applications can render their own presentation or use the
standard component:

```tsx
import { useChat } from "@plaisolutions/react"
import { ChatError, Message } from "@plaisolutions/react/components"
import "@plaisolutions/react/styles.css"

const { messages, error, sendMessage, clearError } = useChat({ transport })

// In the conversation area:
<>
  {messages.map(message => <Message key={message.id} message={message} />)}
  <ChatError error={error} locale="es" />
</>

// On an explicit subsequent submission:
async function submit(text: string) {
  clearError()
  await sendMessage({ text })
}
```

`PlaiChatError.type`, `message` and `cause` remain available. HTTP errors retain
`type: "http_error"` and add optional fields:

| Field | Meaning |
| --- | --- |
| `status` | HTTP status, including ordinary authentication/permission failures |
| `code` | Backend code; absent for responses that provide no code |
| `retryAfterSeconds` | Nonnegative server delay from JSON, or Retry-After seconds/date |
| `periodEnd` | Valid date string from spending cap `period_end` |

Codes recognized by ChatError: `spending_cap_exceeded`,
`spending_cap_accounting_incomplete`, `spending_cap_state_unavailable`,
`rate_limit_exceeded`. HTTP 429 also receives rate-limit guidance without a code.
An ordinary 403 is never inferred to be a spending cap. Other failures get a safe
generic presentation; callers retain the normalized message and original cause
for diagnostics or custom rendering. HTTP message formatting now extracts a
string JSON `detail` while retaining the existing HTTP status prefix; non-JSON upstream bodies are kept in `cause.body` rather
than displayed in `message`. Consumers should use `status`, not parse messages
for numbers such as `401`.

The component supports en, es, ca, fr, it, de, da, sv, no and pt, with English
fallback. Override `title`, `children`, `className` and standard div attributes
to customize it. `error=null` and cancellation render nothing. It never exposes
raw backend bodies or performs automatic retries. Rate-limit delay is the value
at refusal, not a live countdown; the server is authoritative on subsequent
attempts. Renewal dates are shown in UTC.

```tsx
<ChatError error={error} title="Request unavailable">
  <p>Contact our support team if this continues.</p>
</ChatError>
```

Uploads expose normalized errors through `uploadState.error`. A standalone
transport operation (for example transcription) still throws: call
`normalizeError(cause)` and pass the result to ChatError if desired.

Compatible with backends that do not yet implement spending caps: new fields
are optional and existing SSE events and message types are unchanged. Adopt both
updated packages together and keep `error`/`onError` handling to avoid duplicate
toasts. Switching threads should discard host-owned action errors. No automatic
replay should follow a spending cap or rate-limit refusal.
