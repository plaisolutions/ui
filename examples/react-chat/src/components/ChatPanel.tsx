import { PlaiThreadTransport } from "@plaisolutions/client"
import type { SendMessageInput } from "@plaisolutions/client"
import {
  Message,
  Microphone,
  Paperclip,
  PromptForm,
  PromptFormIconButton,
  useChat,
} from "@plaisolutions/react"
import { useMemo, useState } from "react"
import type { ChatSession } from "../api"
import type { DemoConfig } from "../storage"

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

  async function handleSubmit(inputMessage: SendMessageInput) {
    setActionError(null)

    try {
      await sendMessage(inputMessage)
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

      <div className="messages" aria-live="polite">
        {messages.length === 0 ? (
          <p className="messages-empty">No messages yet. Send the first one.</p>
        ) : (
          messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              className={`message message--${message.role}`}
            />
          ))
        )}
      </div>

      <PromptForm
        value={input}
        onValueChange={setInput}
        onSubmit={handleSubmit}
        status={status}
        onStop={stop}
        placeholder="Envía un mensaje..."
        rightSlot={
          <>
            <PromptFormIconButton aria-label="Adjuntar archivo">
              <Paperclip className="size-4" />
            </PromptFormIconButton>
            <PromptFormIconButton aria-label="Entrada de voz">
              <Microphone className="size-4" />
            </PromptFormIconButton>
          </>
        }
      />

      <details className="raw-state">
        <summary>Raw state (debug)</summary>
        <pre>{JSON.stringify({ messages, status, error }, null, 2)}</pre>
      </details>
    </section>
  )
}
