import type { UIEmailSendToolCallPart } from "@plaisolutions/client"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"
import { getUiCopy, getUiStatusLabel } from "./internal/ui-copy"

export type ToolResultEmailSendCardProps = {
  part: UIEmailSendToolCallPart
  className?: string
  locale?: string | null
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
  locale,
}: ToolResultEmailSendCardProps) {
  const copy = getUiCopy(locale)
  const [isExpanded, setIsExpanded] = useState(false)
  const emailInput = parseEmailSendInput(part)
  const emailResult = parseEmailSendResult(part)
  const errorDetails = formatToolErrorDetails(part.errorDetails)

  const statusClass =
    part.state === "error"
      ? "border-danger-border bg-danger-subtle text-danger-strong"
      : part.state === "pending"
        ? "border-warning-border bg-warning-subtle text-warning-strong"
        : "border-success-border bg-success-subtle text-success-strong"

  return (
    <section
      className={joinClasses(
        "plai-tool-result-email-send-card overflow-hidden rounded-lg border border-border bg-surface-muted",
        className,
      )}
      data-tool-call-id={part.id}
      data-tool-call-state={part.state}
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-secondary">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? copy.collapse : copy.expand}
          aria-controls={`tool-email-details-${part.id}`}
          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={() => setIsExpanded((previous) => !previous)}
        >
          <span className="text-sm font-semibold text-foreground">
            {copy.email}
          </span>
          <span className="flex items-center gap-2">
            <span
              className={joinClasses(
                "rounded-full border capitalize px-2 py-0.5 text-xs",
                statusClass,
              )}
            >
              {getUiStatusLabel(part.state, copy)}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
            )}
          </span>
        </button>
      </header>

      <div className="space-y-4 px-3 py-2">
        {emailInput.subject ? (
          <div className="flex items-center gap-1">
            <p className="text-xs font-semibold text-secondary">
              {copy.subject}:
            </p>
            <p className="text-xs text-foreground">{emailInput.subject}</p>
          </div>
        ) : null}

        <div className="flex items-center gap-1">
          <p className="text-xs font-semibold text-secondary">{copy.to}:</p>
          {emailInput.to.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {emailInput.to.map((recipient) => (
                <span
                  key={recipient}
                  className="rounded-full border border-border-strong bg-surface-subtle px-2 py-0.5 text-xs text-strong"
                >
                  {recipient}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">{copy.noRecipientsProvided}</p>
          )}
        </div>

        <div
          id={`tool-email-details-${part.id}`}
          data-testid="email-send-details"
          className={joinClasses(isExpanded ? "block space-y-4" : "hidden")}
        >
          {emailInput.text ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-secondary">
                {copy.body}:
              </p>
              <p className="whitespace-pre-wrap rounded border border-border bg-surface p-2 text-sm text-strong">
                {emailInput.text}
              </p>
            </div>
          ) : null}

          {part.result !== undefined ? (
            <div className="space-y-2 rounded border border-border bg-surface-muted p-3">
              <p className="text-xs font-semibold capitalize tracking-wide text-muted">
                {copy.delivery}
              </p>
              {emailResult.status ? (
                <p className="text-xs text-strong">
                  <span className="font-semibold text-foreground">
                    {copy.status}:
                  </span>{" "}
                  {emailResult.status}
                </p>
              ) : null}
              {emailResult.recipientsCount !== null ? (
                <p className="text-xs text-strong">
                  <span className="font-semibold text-foreground">
                    {copy.recipients}:
                  </span>{" "}
                  {emailResult.recipientsCount}
                </p>
              ) : null}
              {emailResult.receiptProvider ? (
                <p className="text-xs text-strong">
                  <span className="font-semibold text-foreground">
                    {copy.provider}:
                  </span>{" "}
                  {emailResult.receiptProvider}
                </p>
              ) : null}
              {emailResult.receiptMessageId ? (
                <p className="break-all text-xs text-strong">
                  <span className="font-semibold text-foreground">
                    {copy.messageId}:
                  </span>{" "}
                  {emailResult.receiptMessageId}
                </p>
              ) : null}
              {emailResult.receiptRawStatus ? (
                <p className="text-xs text-strong">
                  <span className="font-semibold text-foreground">
                    {copy.rawStatus}:
                  </span>{" "}
                  {emailResult.receiptRawStatus}
                </p>
              ) : null}
              {emailResult.raw ? (
                <p className="whitespace-pre-wrap text-xs text-strong">
                  {emailResult.raw}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {errorDetails ? (
          <p className="rounded border border-danger-border bg-danger-subtle px-3 py-2 text-xs text-danger-strong">
            <span className="font-semibold">{copy.errorDetails}:</span>{" "}
            {errorDetails}
          </p>
        ) : null}
      </div>
    </section>
  )
}
