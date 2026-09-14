import {
  PlaiThreadTransport,
  normalizePlaiThreadMessages,
} from "@plaisolutions/client"
import {
  Clipboard,
  Message,
  MessageAvatar,
  MessageFooter,
  PromptForm,
  Reload,
  SpeechToTextToggle,
  ThumbDown,
  ThumbUp,
  useChat,
} from "@plaisolutions/react"
import type {
  InvalidPromptFormFile,
  MessageRating,
  PromptFormSubmitInput,
} from "@plaisolutions/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { type ChatSession, getThread } from "../api"
import type { DemoConfig } from "../storage"
import { ChatMarkdown } from "./ChatMarkdown"

type ChatPanelProps = {
  session: ChatSession
  config: DemoConfig
  onDisconnect: () => void
}

export function ChatPanel({ session, config, onDisconnect }: ChatPanelProps) {
  const [input, setInput] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [isHydratingThread, setIsHydratingThread] = useState(true)
  const [messageRatings, setMessageRatings] = useState<
    Record<string, MessageRating>
  >({})
  const messagesRef = useRef<HTMLDivElement>(null)

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

  const {
    messages,
    status,
    error,
    uploadState,
    sendMessage,
    resendMessage,
    rateMessage,
    transcribeAudio,
    uploadFile,
    stop,
    hydrate,
  } = useChat({ transport })

  const isBusy =
    status === "submitted" ||
    status === "streaming" ||
    uploadState.status === "uploading" ||
    uploadState.status === "processing"
  const chatError =
    actionError ?? (error ? `${error.type}: ${error.message}` : null)

  useEffect(() => {
    if (messages.length === 0) return
    const viewport = messagesRef.current
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    let isCurrent = true

    void getThread({
      api: config.api,
      chatSessionId: session.id,
      threadId: session.thread_id,
      chatToken: session.chat_token,
    })
      .then((thread) => {
        if (isCurrent) hydrate(normalizePlaiThreadMessages(thread.messages))
      })
      .catch(() => {
        // A new session starts with an empty thread; failure here is non-fatal.
      })
      .finally(() => {
        if (isCurrent) setIsHydratingThread(false)
      })

    return () => {
      isCurrent = false
    }
  }, [config.api, hydrate, session])

  async function handleSubmit({ text, files }: PromptFormSubmitInput) {
    setActionError(null)

    try {
      const documents = []
      for (const file of files) {
        const mediaFile = await uploadFile(file)
        documents.push({
          mediaFileId: mediaFile.id,
          url: mediaFile.url,
          filename: mediaFile.name || file.name,
        })
      }
      setInput("")
      setFiles([])
      await sendMessage({ text, documents })
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

  function handleInvalidFiles(invalidFiles: InvalidPromptFormFile[]) {
    setActionError(
      invalidFiles
        .map(({ file, reason }) => `${file.name}: ${reason}`)
        .join("\n"),
    )
  }

  async function handleResendMessage(messageId: string) {
    if (isBusy) return
    setActionError(null)
    try {
      await resendMessage({ messageId })
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to retry the response.",
      )
    }
  }

  async function handleRateMessage(messageId: string, rating: MessageRating) {
    setActionError(null)
    try {
      await rateMessage({ messageId, rating })
      setMessageRatings((current) => ({ ...current, [messageId]: rating }))
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to rate the response.",
      )
    }
  }

  return (
    <main className="chat-shell">
      <div ref={messagesRef} className="messages-viewport" aria-live="polite">
        <div className="messages-content">
          <div className="messages-list">
            {isHydratingThread && messages.length === 0 ? (
              <div className="messages-skeleton" aria-label="Loading messages">
                <span className="skeleton-line skeleton-line--user" />
                <span className="skeleton-line skeleton-line--assistant" />
                <span className="skeleton-line skeleton-line--assistant-short" />
              </div>
            ) : null}
            {messages.map((message) => {
              const persistedMessageId =
                message.metadata?.persistedMessageId ?? message.id
              const text = message.parts
                .filter((part) => part.type === "text")
                .map((part) => (part.type === "text" ? part.text : ""))
                .join("\n")
              const isStreamingMessage = isBusy && message === messages.at(-1)

              return (
                <Message
                  key={message.id}
                  message={message}
                  avatar={
                    message.role === "assistant" && session.agent?.avatar ? (
                      <MessageAvatar
                        className="message-avatar"
                        src={session.agent.avatar}
                        fallback={session.agent.name || "AI"}
                      />
                    ) : undefined
                  }
                  messageClassName={`message message--${message.role}`}
                  contentClassName={`message-content message-content--${message.role}`}
                  partsClassName="message-parts"
                  toolPartsClassName="message-parts"
                  messagePartsProps={{
                    locale: "en",
                    isStreaming: isStreamingMessage,
                    thinkingLabel: "Thinking…",
                    completedThinkingLabel: "Reasoning summary",
                    readMoreLabel: "Read more",
                    readLessLabel: "Read less",
                    renderText: (part) => <ChatMarkdown text={part.text} />,
                  }}
                  footer={
                    message.role === "assistant" && text ? (
                      <MessageFooter className="message-actions">
                        <Clipboard
                          className="message-action"
                          text={text}
                          copyLabel="Copy"
                          copiedLabel="Copied"
                        />
                        <ThumbUp
                          className="message-action"
                          label="Rate positively"
                          aria-pressed={
                            messageRatings[persistedMessageId] === "POSITIVE"
                          }
                          onClick={() =>
                            void handleRateMessage(
                              persistedMessageId,
                              "POSITIVE",
                            )
                          }
                        />
                        <ThumbDown
                          className="message-action"
                          label="Rate negatively"
                          aria-pressed={
                            messageRatings[persistedMessageId] === "NEGATIVE"
                          }
                          onClick={() =>
                            void handleRateMessage(
                              persistedMessageId,
                              "NEGATIVE",
                            )
                          }
                        />
                        {!isStreamingMessage ? (
                          <Reload
                            className="message-action"
                            label="Retry"
                            disabled={isBusy}
                            onClick={() => void handleResendMessage(message.id)}
                          />
                        ) : null}
                      </MessageFooter>
                    ) : undefined
                  }
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="composer-dock">
        <div className="composer-container">
          {chatError ? (
            <p className="chat-error" role="alert">
              {chatError}
            </p>
          ) : null}
          <PromptForm
            value={input}
            onValueChange={setInput}
            files={files}
            onFilesChange={setFiles}
            onSubmit={handleSubmit}
            clearOnSubmit={false}
            status={status}
            uploadState={uploadState}
            onStop={stop}
            disabled={isHydratingThread}
            enableAttachments
            onInvalidFiles={handleInvalidFiles}
            placeholder="Send a message..."
            className="composer"
            attachLabel="Attach file"
            sendLabel="Send message"
            stopLabel="Stop generation"
            rightSlot={
              <SpeechToTextToggle
                transcribe={transcribeAudio}
                onTranscriptionComplete={handleTranscriptionComplete}
                onTranscriptionError={handleTranscriptionError}
                disabled={isBusy}
                label="Voice input"
                listeningLabel="Stop recording"
                loadingLabel="Transcribing..."
              />
            }
          />
          <div className="disclaimer">
            <span>
              You are interacting with an Artificial Intelligence, so the
              answers may not be 100% accurate. We recommend reviewing the
              information provided.
            </span>
            <span aria-hidden="true"> · </span>
            <button type="button" onClick={onDisconnect}>
              Change connection
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
