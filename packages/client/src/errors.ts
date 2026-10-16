import type { PlaiChatError, StreamErrorType } from "./types"

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProtocolError"
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
