import { ProtocolError } from "./errors"
import type { PlaiSseEvent } from "./types"

const ALLOWED_EVENT_TYPES = new Set([
  "message_start",
  "content_block_start",
  "content_block_delta",
  "content_block_stop",
  "tool_result",
  "message_id",
  "usage",
  "message_stop",
  "error",
])

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<PlaiSseEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      buffer += decoder.decode()
      break
    }

    buffer += decoder.decode(value, { stream: true })
    yield* consumeBuffer(false)
  }

  yield* consumeBuffer(true)

  function* consumeBuffer(
    isFinal: boolean,
  ): Generator<PlaiSseEvent, void, undefined> {
    while (true) {
      const normalized = buffer.replace(/\r\n/g, "\n")
      const boundaryIndex = normalized.indexOf("\n\n")

      if (boundaryIndex < 0) {
        buffer = normalized
        break
      }

      const rawFrame = normalized.slice(0, boundaryIndex)
      buffer = normalized.slice(boundaryIndex + 2)

      if (!rawFrame.trim()) {
        continue
      }

      const event = parseSseFrame(rawFrame)
      if (event) {
        yield event
      }
    }

    if (isFinal && buffer.trim()) {
      const event = parseSseFrame(buffer)
      buffer = ""
      if (event) {
        yield event
      }
    }
  }
}

function parseSseFrame(frame: string): PlaiSseEvent | null {
  const lines = frame.split("\n")
  let eventName = ""
  const dataLines: string[] = []

  for (const line of lines) {
    if (!line) {
      continue
    }

    if (line.startsWith(":")) {
      continue
    }

    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim()
      continue
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart())
    }
  }

  if (!dataLines.length) {
    return null
  }

  const dataText = dataLines.join("\n")
  let parsed: unknown
  try {
    parsed = JSON.parse(dataText)
  } catch {
    throw new ProtocolError(`Invalid JSON in SSE frame: ${dataText}`)
  }

  if (!parsed || typeof parsed !== "object") {
    throw new ProtocolError("SSE payload must be a JSON object.")
  }

  const type = (parsed as { type?: unknown }).type
  if (typeof type !== "string" || !ALLOWED_EVENT_TYPES.has(type)) {
    throw new ProtocolError(`Unknown SSE event type: ${String(type)}`)
  }

  if (eventName && eventName !== type) {
    throw new ProtocolError(
      `SSE event name (${eventName}) does not match payload type (${type}).`,
    )
  }

  return parsed as PlaiSseEvent
}
