import type { UIToolCallPart } from "@plaisolutions/client"
import { joinClasses } from "./internal/join-classes"

export type ToolResultCardProps = {
  part: UIToolCallPart
  className?: string
  detailsOpen?: boolean
}

function formatStatus(status: UIToolCallPart["state"]) {
  if (status === "pending") return "pending"
  if (status === "error") return "error"
  return "completed"
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

export function ToolResultCard({
  part,
  className,
  detailsOpen = true,
}: ToolResultCardProps) {
  const statusClass =
    part.state === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : part.state === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800"

  return (
    <section
      className={joinClasses(
        "space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3",
        className,
      )}
      data-tool-call-id={part.id}
      data-tool-call-state={part.state}
    >
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{part.name}</h4>
        <span
          className={joinClasses(
            "rounded-full border px-2 py-0.5 text-xs font-medium",
            statusClass,
          )}
        >
          {formatStatus(part.state)}
        </span>
      </header>

      {part.toolType ? (
        <p className="text-xs text-slate-600">
          <span className="font-semibold">Type:</span> {part.toolType}
        </p>
      ) : null}

      <details open={detailsOpen} className="space-y-2">
        <summary className="cursor-pointer text-xs font-semibold text-slate-600">
          Input
        </summary>
        <pre className="overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100">
          {formatJson(part.input)}
        </pre>
      </details>

      {part.result !== undefined ? (
        <details open={detailsOpen} className="space-y-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">
            Output
          </summary>
          <pre className="overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100">
            {formatJson(part.result)}
          </pre>
        </details>
      ) : null}

      {part.errorDetails ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <span className="font-semibold">Error details:</span>{" "}
          {part.errorDetails}
        </p>
      ) : null}
    </section>
  )
}
