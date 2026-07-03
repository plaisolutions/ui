import type { UIMessage, UIMessagePart } from "@plaisolutions/client"

export type MessageProps = {
  message: UIMessage
  className?: string
  showRole?: boolean
}

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function renderPart(part: UIMessagePart, index: number) {
  if (part.type === "text") {
    return (
      <p key={`text-${index}`} className="whitespace-pre-wrap text-sm leading-6">
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

  return (
    <section
      key={`tool-${part.id}-${index}`}
      className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <h4 className="text-sm font-semibold text-slate-900">{part.name}</h4>
      <p className="text-xs text-slate-600">Status: {part.state}</p>
      <pre className="overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100">
        {JSON.stringify(part.input, null, 2)}
      </pre>
      {part.result !== undefined ? (
        <pre className="overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100">
          {JSON.stringify(part.result, null, 2)}
        </pre>
      ) : null}
      {part.errorDetails ? (
        <p className="text-xs text-rose-700">{part.errorDetails}</p>
      ) : null}
    </section>
  )
}

export function Message({ message, className, showRole = true }: MessageProps) {
  const roleLabel = message.role.charAt(0).toUpperCase() + message.role.slice(1)

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
        {message.parts.map((part, index) => renderPart(part, index))}
      </div>
    </article>
  )
}
