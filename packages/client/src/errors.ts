import type {
  PlaiChatError,
  StreamErrorType,
  ToolDecisionError,
  ToolSubmissionConflict,
} from "./types"

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProtocolError"
  }
}

/**
 * The server rejected the edit of a decision (HTTP 422 `invalid_tool_decision`)
 * before anything ran. The chat itself is fine: nothing was sent, every action
 * of the submission is still pending and the card keeps its draft.
 */
export class ToolDecisionRejectedError extends Error {
  readonly details: ToolDecisionError

  readonly error: PlaiChatError

  constructor(details: ToolDecisionError, error: PlaiChatError) {
    super(error.message)
    this.name = "ToolDecisionRejectedError"
    this.details = details
    this.error = error
  }
}

/**
 * The server answered a decision submission with a conflict about its key: it is
 * already being applied (`decision_in_progress`) or the key was used with another
 * request (`decision_request_conflict`). This request applied nothing and the
 * chat is intact; the cards follow the real state from the server.
 */
export class ToolSubmissionConflictError extends Error {
  readonly details: ToolSubmissionConflict

  readonly error: PlaiChatError

  constructor(details: ToolSubmissionConflict, error: PlaiChatError) {
    super(error.message)
    this.name = "ToolSubmissionConflictError"
    this.details = details
    this.error = error
  }
}

export class HttpStatusError extends Error {
  readonly status: number

  readonly statusText: string

  readonly body: string

  readonly headers: Headers

  constructor(
    status: number,
    statusText: string,
    body: string,
    headers?: HeadersInit,
  ) {
    super(`HTTP ${status} ${statusText}`.trim())
    this.name = "HttpStatusError"
    this.status = status
    this.statusText = statusText
    this.body = body
    this.headers = new Headers(headers)
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

export function normalizeError(error: unknown): PlaiChatError {
  if (isAbortError(error)) {
    return {
      type: "abort_error",
      message: "Request was aborted.",
      cause: error,
    }
  }

  if (error instanceof ProtocolError) {
    return {
      type: "protocol_error",
      message: error.message,
      cause: error,
    }
  }

  if (error instanceof HttpStatusError) {
    const body = parseHttpErrorBody(error.body)
    const retryAfterSeconds =
      nonNegativeNumber(body?.retry_after_seconds) ??
      parseRetryAfter(error.headers.get("Retry-After"))
    const code = nonEmptyString(body?.code)
    const periodEnd = nonEmptyString(body?.period_end)
    const detail = nonEmptyString(body?.detail)
    const toolDecision =
      code === "invalid_tool_decision" ? toolDecisionError(body) : undefined
    const toolSubmission =
      code === "decision_in_progress" || code === "decision_request_conflict"
        ? ({
            code,
            executionId: nonEmptyString(body?.execution_id) ?? null,
          } as ToolSubmissionConflict)
        : undefined
    return {
      type: "http_error",
      // Preserve the HTTP prefix for existing consumers matching e.g. "401".
      message: `${error.message}${detail ? `: ${detail}` : ""}`,
      status: error.status,
      ...(code ? { code } : {}),
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      ...(periodEnd && Number.isFinite(Date.parse(periodEnd))
        ? { periodEnd }
        : {}),
      ...(toolDecision ? { toolDecision } : {}),
      ...(toolSubmission ? { toolSubmission } : {}),
      cause: error,
    }
  }

  if (error instanceof TypeError) {
    return {
      type: "network_error",
      message: error.message || "Network error while fetching stream.",
      cause: error,
    }
  }

  if (isStreamErrorLike(error)) {
    return {
      type: error.error.type,
      message: error.error.message,
      cause: error,
    }
  }

  return {
    type: "internal_error",
    message:
      error instanceof Error ? error.message : "Unexpected internal error.",
    cause: error,
  }
}

function parseHttpErrorBody(body: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(body)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null
    const record = parsed as Record<string, unknown>
    // Accept both the public top-level contract and FastAPI's nested detail.
    if (
      record.detail &&
      typeof record.detail === "object" &&
      !Array.isArray(record.detail)
    ) {
      return {
        ...(record.detail as Record<string, unknown>),
        ...record,
        detail: (record.detail as Record<string, unknown>).detail,
      }
    }
    return record
  } catch {
    return null
  }
}

function toolDecisionError(
  body: Record<string, unknown> | null,
): ToolDecisionError | undefined {
  const actionId = nonEmptyString(body?.action_id)
  const raw = body?.errors
  if (!actionId || !Array.isArray(raw)) return undefined
  const errors = raw.flatMap((item: unknown) => {
    const record =
      item && typeof item === "object"
        ? (item as Record<string, unknown>)
        : null
    const field = nonEmptyString(record?.field)
    const message = nonEmptyString(record?.message)
    const code = nonEmptyString(record?.code)
    return field && message
      ? [{ field, message, ...(code ? { code } : {}) }]
      : []
  })
  return { actionId, errors }
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.ceil(value)
    : undefined
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value?.trim()) return undefined
  if (/^\d+$/.test(value.trim())) return nonNegativeNumber(Number(value))
  // A signed/fractional number is not an HTTP date.
  if (/^[+\-\d.]+$/.test(value.trim())) return undefined
  const date = Date.parse(value)
  return Number.isFinite(date)
    ? Math.max(0, Math.ceil((date - Date.now()) / 1000))
    : undefined
}

function isStreamErrorLike(
  error: unknown,
): error is { error: { type: StreamErrorType; message: string } } {
  if (!error || typeof error !== "object") {
    return false
  }

  const maybeError = (error as { error?: unknown }).error
  if (!maybeError || typeof maybeError !== "object") {
    return false
  }

  const type = (maybeError as { type?: unknown }).type
  const message = (maybeError as { message?: unknown }).message

  return (
    (type === "context_length_exceeded" ||
      type === "llm_error" ||
      type === "http_error" ||
      type === "internal_error") &&
    typeof message === "string"
  )
}
