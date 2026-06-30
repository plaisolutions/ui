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

  constructor(status: number, statusText: string, body: string) {
    super(`HTTP ${status} ${statusText}`.trim())
    this.name = "HttpStatusError"
    this.status = status
    this.statusText = statusText
    this.body = body
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
    return {
      type: "http_error",
      message: `${error.message}${error.body ? `: ${error.body}` : ""}`,
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
