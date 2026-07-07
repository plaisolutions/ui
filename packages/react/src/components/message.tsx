import type { UIMessage, UIMessagePart } from "@plaisolutions/client"
import { useMemo, useState } from "react"
import { joinClasses } from "./internal/join-classes"
import { ToolResultCard } from "./tool-result-card"

export type MessageProps = {
  message: UIMessage
  className?: string
  showRole?: boolean
  collapseThreshold?: number
}

const DEFAULT_COLLAPSE_THRESHOLD = 600

function renderPart(part: UIMessagePart, index: number) {
  if (part.type === "text") {
    return (
      <p
        key={`text-${index}`}
        className="whitespace-pre-wrap text-sm leading-6"
      >
        {part.text}
      </p>
    )
  }

  if (part.type === "guardrail") {
    return (
      <p
        key={`guardrail-${index}`}
        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      >
        {part.content}
      </p>
    )
  }

  return <ToolResultCard key={`tool-${part.id}-${index}`} part={part} />
}

export function Message({
  message,
  className,
  showRole = true,
  collapseThreshold = DEFAULT_COLLAPSE_THRESHOLD,
}: MessageProps) {
  const roleLabel = message.role.charAt(0).toUpperCase() + message.role.slice(1)
  const [isExpanded, setIsExpanded] = useState(false)
  const textContent = useMemo(() => {
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
  }, [message.parts])

  const canCollapse =
    message.role === "user" &&
    message.parts.every((part) => part.type === "text") &&
    textContent.length > collapseThreshold

  const previewText = canCollapse
    ? `${textContent.slice(0, collapseThreshold).trimEnd()}...`
    : textContent

  return (
    <article
      className={joinClasses(
        "space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
        className,
      )}
      data-message-role={message.role}
    >
      {showRole ? (
        <header className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {roleLabel}
        </header>
      ) : null}
      <div className="space-y-2">
        {canCollapse && !isExpanded ? (
          <p className="whitespace-pre-wrap text-sm leading-6">{previewText}</p>
        ) : (
          message.parts.map((part, index) => renderPart(part, index))
        )}
      </div>
      {canCollapse ? (
        <button
          type="button"
          className="text-left text-xs font-medium text-slate-600 hover:text-slate-900"
          onClick={() => setIsExpanded((previous) => !previous)}
        >
          {isExpanded ? "Read less" : "Read more"}
        </button>
      ) : null}
    </article>
  )
}
