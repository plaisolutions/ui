import { PlaiThreadTransport } from "@plaisolutions/client"
import {
  Message,
  PromptForm,
  PromptFormAttachButton,
  SpeechToTextToggle,
  useChat,
} from "@plaisolutions/react"
import type {
  InvalidPromptFormFile,
  PromptFormSubmitInput,
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
  const [files, setFiles] = useState<File[]>([])
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

  async function handleSubmit({ text, files }: PromptFormSubmitInput) {
    setActionError(null)

    if (files.length > 0) {
      setActionError(
        "File upload is not configured in this demo. Wire upload in your host app and pass documents to sendMessage.",
      )
      return
    }

    try {
      await sendMessage({ text })
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to send message.",
      )
    }
  }

  function handleTranscriptionComplete(text: string) {
    setInput((current) => (current ? `${current} ${text}` : text))
  }

  function handleTranscriptionError(error: Error) {
    setActionError(error.message)
  }

  function handleFilesSelected(nextFiles: File[]) {
    setFiles((current) => [...current, ...nextFiles])
  }

  function handleInvalidFiles(invalidFiles: InvalidPromptFormFile[]) {
    setActionError(
      invalidFiles
        .map(({ file, reason }) => `${file.name}: ${reason}`)
        .join("\n"),
    )
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
              datasourceToolResultsPosition="before-content"
            />
          ))
        )}
      </div>

      <PromptForm
        value={input}
        onValueChange={setInput}
        files={files}
        onFilesChange={setFiles}
        onSubmit={handleSubmit}
        status={status}
        onStop={stop}
        enableAttachments={false}
        placeholder="Envía un mensaje..."
        rightSlot={
          <>
            <PromptFormAttachButton
              onFilesSelected={handleFilesSelected}
              onInvalidFiles={handleInvalidFiles}
              disabled={isBusy}
              label="Adjuntar archivo"
            />
            <SpeechToTextToggle
              onTranscriptionComplete={handleTranscriptionComplete}
              onTranscriptionError={handleTranscriptionError}
              disabled={isBusy}
              label="Entrada de voz"
              listeningLabel="Detener grabación"
              loadingLabel="Transcribiendo..."
            />
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
