import type { UIMessage } from "@plai/client"

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
}

type MessagesProps = {
  messages: UIMessage[]
}

export function Messages({ messages }: MessagesProps) {
  if (messages.length === 0) {
    return (
      <div className="messages" aria-live="polite">
        <p className="messages-empty">No messages yet. Send the first one.</p>
      </div>
    )
  }

  return (
    <div className="messages" aria-live="polite">
      {messages.map((message) => {
        const toolParts = message.parts.filter(
          (part) => part.type === "tool-call",
        )

        return (
          <article
            key={message.id}
            className={`message message--${message.role}`}
          >
            <span className="message-role">{message.role}</span>
            <p className="message-text">
              {getMessageText(message) || "(no text)"}
            </p>
            {toolParts.length > 0 && (
              <details className="message-tools">
                <summary>{toolParts.length} tool call(s)</summary>
                <pre>{JSON.stringify(toolParts, null, 2)}</pre>
              </details>
            )}
          </article>
        )
      })}
    </div>
  )
}
