import { HttpStatusError } from "./errors"
import { parseSseStream } from "./sse"
import type { ChatTransport, ChatTransportRequest, PlaiSseEvent } from "./types"

export type PlaiThreadTransportOptions = {
  api: string
  chatSessionId?: string
  threadId?: string
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>)
  credentials?: RequestCredentials
  body?: (request: ChatTransportRequest) => unknown
  fetch?: typeof fetch
}

export class PlaiThreadTransport implements ChatTransport {
  private readonly options: PlaiThreadTransportOptions

  constructor(options: PlaiThreadTransportOptions) {
    this.options = options
  }

  async *stream(request: ChatTransportRequest): AsyncIterable<PlaiSseEvent> {
    const fetchImpl = this.options.fetch ?? globalThis.fetch
    if (!fetchImpl) {
      throw new Error("No fetch implementation available.")
    }

    const endpoint = this.resolveEndpoint()
    const headers = await this.resolveHeaders()
    headers.set("Content-Type", "application/json")
    headers.set("Accept", "text/event-stream")

    const payload = this.options.body?.(request) ?? {
      prompt: request.message.text,
      enabled_tools: request.message.enabledTools,
      documents: request.message.documents,
    }

    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers,
      credentials: this.options.credentials,
      body: JSON.stringify(payload),
      signal: request.signal,
    })

    if (!response.ok) {
      const body = await safeReadResponseText(response)
      throw new HttpStatusError(response.status, response.statusText, body)
    }

    if (!response.body) {
      throw new Error("SSE response did not include a body stream.")
    }

    for await (const event of parseSseStream(response.body)) {
      yield event
    }
  }

  private resolveEndpoint(): string {
    const { api, chatSessionId, threadId } = this.options
    if (chatSessionId && threadId) {
      const base = api.endsWith("/") ? api.slice(0, -1) : api
      return `${base}/chat_sessions/${encodeURIComponent(chatSessionId)}/threads/${encodeURIComponent(threadId)}/invoke`
    }

    return api
  }

  private async resolveHeaders(): Promise<Headers> {
    const { headers } = this.options

    if (!headers) {
      return new Headers()
    }

    if (typeof headers === "function") {
      return new Headers(await headers())
    }

    return new Headers(headers)
  }
}

async function safeReadResponseText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ""
  }
}
