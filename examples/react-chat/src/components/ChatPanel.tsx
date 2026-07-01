import { PlaiThreadTransport } from "@plaisolutions/client"
import { useChat } from "@plaisolutions/react"
import { useMemo, useState } from "react"
import type { ChatSession } from "../api"
import type { DemoConfig } from "../storage"
import { Messages } from "./Messages"

type ChatPanelProps = {
  session: ChatSession
  config: DemoConfig
  onNewThread: () => Promise<void>
}

export function ChatPanel({ session, config, onNewThread }: ChatPanelProps) {
  const [input, setInput] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)
  const [isCreatingThread, setIsCreatingThread] = useState(false)

  const transport = useMemo(
    () =>
      new PlaiThreadTransport({
        api: config.api,
        chatSessionId: session.id,
        threadId: session.thread_id,
        headers: { Authorization: `Bearer ${session.chat_token}` },
      }),
    [config.api, session.id, session.thread_id, session.chat_token],
  )

  const { messages, status, error, sendMessage, stop } = useChat({ transport })

  const isBusy = status === "submitted" || status === "streaming"
  const chatError =
    actionError ?? (error ? `${error.type}: ${error.message}` : null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const text = input.trim()
    if (!text) return

    setInput("")
    setActionError(null)

    try {
      await sendMessage({ text })
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to send message.",
      )
    }
  }

  async function handleNewThread() {
    setActionError(null)
    setIsCreatingThread(true)

    try {
      await onNewThread()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to create thread.",
      )
    } finally {
      setIsCreatingThread(false)
    }
  }

  return (
    <section className="panel chat-panel">
      <div className="chat-header">
        <div>
          <h2>2. Chat</h2>
          <dl className="session-dl">
            <div>
              <dt>Session ID</dt>
              <dd>
                <code>{session.id}</code>
              </dd>
            </div>
            <div>
              <dt>Thread ID</dt>
              <dd>
                <code>{session.thread_id}</code>
              </dd>
            </div>
            <div>
              <dt>Agent ID</dt>
              <dd>
                <code>{session.agent_id}</code>
              </dd>
            </div>
          </dl>
        </div>
        <div className="chat-header-actions">
          <span className="status-pill" data-status={status}>
            {status}
          </span>
          <button
            type="button"
            className="secondary"
            onClick={handleNewThread}
            disabled={isCreatingThread || isBusy}
          >
            {isCreatingThread ? "Creating…" : "New thread"}
          </button>
        </div>
      </div>

      {chatError && <p className="error">{chatError}</p>}

      <Messages messages={messages} />

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message…"
          autoComplete="off"
          disabled={isBusy}
        />
        <button type="submit" disabled={isBusy}>
          Send
        </button>
        <button
          type="button"
          className="secondary"
          onClick={stop}
          disabled={!isBusy}
        >
          Stop
        </button>
      </form>

      <details className="raw-state">
        <summary>Raw state (debug)</summary>
        <pre>{JSON.stringify({ messages, status, error }, null, 2)}</pre>
      </details>
    </section>
  )
}
