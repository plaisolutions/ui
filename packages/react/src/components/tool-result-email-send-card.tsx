import type { UIEmailSendToolCallPart } from "@plaisolutions/client"
import { useState } from "react"
import { joinClasses } from "./internal/join-classes"

export type ToolResultEmailSendCardProps = {
  part: UIEmailSendToolCallPart
  className?: string
}

type EmailSendInputView = {
  to: string[]
  subject: string | null
  text: string | null
}

type EmailSendResultView = {
  status: string | null
  recipientsCount: number | null
  subject: string | null
  receiptProvider: string | null
  receiptMessageId: string | null
  receiptRawStatus: string | null
  raw: string | null
}

function formatStatus(status: UIEmailSendToolCallPart["state"]) {
  if (status === "pending") return "pending"
  if (status === "error") return "error"
  return "completed"
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function parseEmailSendInput(
  part: UIEmailSendToolCallPart,
): EmailSendInputView {
  const input = asObject(part.input)
  if (!input) {
    return { to: [], subject: null, text: null }
  }

  const recipients = Array.isArray(input.to)
    ? input.to.filter((item): item is string => typeof item === "string")
    : []

  return {
    to: recipients,
    subject: toStringOrNull(input.subject),
    text: toStringOrNull(input.text),
  }
}

function parseEmailSendResult(
  part: UIEmailSendToolCallPart,
): EmailSendResultView {
  const initial: EmailSendResultView = {
    status: null,
    recipientsCount: null,
    subject: null,
    receiptProvider: null,
    receiptMessageId: null,
    receiptRawStatus: null,
    raw: null,
  }

  if (part.result === undefined || part.result === null) {
    return initial
  }

  let resultObject = asObject(part.result)
  let raw: string | null = null

  if (!resultObject && typeof part.result === "string") {
    try {
      const parsed = JSON.parse(part.result) as unknown
      resultObject = asObject(parsed)
    } catch {
      raw = part.result
    }
  }

  if (!resultObject) {
    return { ...initial, raw }
  }

  const receipt = asObject(resultObject.receipt)

  return {
    status: toStringOrNull(resultObject.status),
    recipientsCount: toNumberOrNull(resultObject.recipients_count),
    subject: toStringOrNull(resultObject.subject),
    receiptProvider: receipt ? toStringOrNull(receipt.provider) : null,
    receiptMessageId: receipt ? toStringOrNull(receipt.message_id) : null,
    receiptRawStatus: receipt ? toStringOrNull(receipt.raw_status) : null,
    raw,
  }
}

export function ToolResultEmailSendCard({
  part,
  className,
}: ToolResultEmailSendCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const emailInput = parseEmailSendInput(part)
  const emailResult = parseEmailSendResult(part)

  const statusClass =
    part.state === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : part.state === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800"

  return (
    <section
      className={joinClasses(
        "space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3",
        className,
      )}
      data-tool-call-id={part.id}
      data-tool-call-state={part.state}
    >
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">Email</h4>
        <div className="flex items-center gap-2">
          <span
            className={joinClasses(
              "rounded-full border px-2 py-0.5 text-xs font-medium",
              statusClass,
            )}
          >
            {formatStatus(part.state)}
          </span>
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={`tool-email-details-${part.id}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-100"
            onClick={() => setIsExpanded((previous) => !previous)}
          >
            <span className="inline-block">{isExpanded ? "^" : "v"}</span>
          </button>
        </div>
      </header>

      {emailInput.subject ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-600">Subject</p>
          <p className="text-sm text-slate-900">{emailInput.subject}</p>
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-600">To</p>
        {emailInput.to.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {emailInput.to.map((recipient) => (
              <span
                key={recipient}
                className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
              >
                {recipient}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No recipients provided.</p>
        )}
      </div>

      <div
        id={`tool-email-details-${part.id}`}
        data-testid="email-send-details"
        className={joinClasses(isExpanded ? "block space-y-4" : "hidden")}
      >
        {emailInput.text ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-600">Body</p>
            <p className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
              {emailInput.text}
            </p>
          </div>
        ) : null}

        {part.result !== undefined ? (
          <div className="space-y-2 rounded border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Delivery
            </p>
            {emailResult.status ? (
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Status:</span>{" "}
                {emailResult.status}
              </p>
            ) : null}
            {emailResult.recipientsCount !== null ? (
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Recipients:</span>{" "}
                {emailResult.recipientsCount}
              </p>
            ) : null}
            {emailResult.receiptProvider ? (
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Provider:</span>{" "}
                {emailResult.receiptProvider}
              </p>
            ) : null}
            {emailResult.receiptMessageId ? (
              <p className="break-all text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Message ID:</span>{" "}
                {emailResult.receiptMessageId}
              </p>
            ) : null}
            {emailResult.receiptRawStatus ? (
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Raw status:</span>{" "}
                {emailResult.receiptRawStatus}
              </p>
            ) : null}
            {emailResult.raw ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {emailResult.raw}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {part.errorDetails ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <span className="font-semibold">Error details:</span>{" "}
          {part.errorDetails}
        </p>
      ) : null}
    </section>
  )
}
