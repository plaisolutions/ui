import { HttpStatusError, ProtocolError } from "./errors"
import { parseSseStream } from "./sse"
import type {
  ChatTransport,
  ChatTransportRequest,
  MediaFile,
  PlaiSseEvent,
  RateMessageInput,
  SendMessageDocument,
  UploadFileTransportRequest,
} from "./types"

export type PlaiThreadTransportOptions = {
  api: string
  chatSessionId?: string
  threadId?: string
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>)
  credentials?: RequestCredentials
  body?: (request: ChatTransportRequest) => unknown
  fetch?: typeof fetch
  xhr?: () => XMLHttpRequest
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
      ...(request.message.enabledTools &&
      request.message.enabledTools.length > 0
        ? { enabled_tools: request.message.enabledTools }
        : {}),
      ...(request.message.documents && request.message.documents.length > 0
        ? { documents: request.message.documents.map(serializeDocument) }
        : {}),
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

  async rateMessage({ messageId, rating }: RateMessageInput): Promise<void> {
    const fetchImpl = this.options.fetch ?? globalThis.fetch
    if (!fetchImpl) {
      throw new Error("No fetch implementation available.")
    }

    const headers = await this.resolveHeaders()
    headers.set("Content-Type", "application/json")
    headers.set("Accept", "application/json")

    const response = await fetchImpl(this.resolveRateMessageEndpoint(), {
      method: "POST",
      headers,
      credentials: this.options.credentials,
      body: JSON.stringify({
        message_id: messageId,
        rating,
      }),
    })

    if (!response.ok) {
      const body = await safeReadResponseText(response)
      throw new HttpStatusError(response.status, response.statusText, body)
    }
  }

  async transcribeAudio(audio: Blob, signal?: AbortSignal): Promise<string> {
    const fetchImpl = this.options.fetch ?? globalThis.fetch
    if (!fetchImpl) {
      throw new Error("No fetch implementation available.")
    }

    const headers = await this.resolveHeaders()
    // The browser must add the multipart boundary for this request.
    headers.delete("Content-Type")
    headers.set("Accept", "application/json")

    const body = new FormData()
    body.append("file", audio, resolveAudioFilename(audio))

    const response = await fetchImpl(this.resolveTranscriptionEndpoint(), {
      method: "POST",
      headers,
      credentials: this.options.credentials,
      body,
      signal,
    })

    if (!response.ok) {
      const responseBody = await safeReadResponseText(response)
      throw new HttpStatusError(
        response.status,
        response.statusText,
        responseBody,
      )
    }

    let transcription: unknown
    try {
      transcription = await response.json()
    } catch {
      throw new ProtocolError(
        "The transcription response must be a JSON string.",
      )
    }

    if (typeof transcription !== "string") {
      throw new ProtocolError(
        "The transcription response must be a JSON string.",
      )
    }

    return transcription
  }

  async uploadFile(request: UploadFileTransportRequest): Promise<MediaFile> {
    if (request.signal.aborted) {
      throw request.signal.reason ?? new DOMException("Aborted", "AbortError")
    }

    const headers = await this.resolveHeaders()
    if (request.signal.aborted) {
      throw request.signal.reason ?? new DOMException("Aborted", "AbortError")
    }
    headers.delete("Content-Type")
    headers.set("Accept", "application/json")

    const xhr = this.createXhr()
    const body = new FormData()
    body.append("file", request.file, request.file.name)

    return new Promise<MediaFile>((resolve, reject) => {
      const handleAbort = () => xhr.abort()
      const cleanup = () => {
        request.signal.removeEventListener("abort", handleAbort)
      }

      xhr.upload.addEventListener("progress", (event) => {
        const totalBytes = event.lengthComputable
          ? event.total
          : request.file.size
        const loadedBytes = Math.min(event.loaded, totalBytes)
        request.onProgress({
          loadedBytes,
          totalBytes,
          progress:
            totalBytes > 0
              ? Math.min(100, Math.max(0, (loadedBytes / totalBytes) * 100))
              : 0,
        })
      })
      xhr.upload.addEventListener("load", request.onUploaded)
      xhr.addEventListener("load", () => {
        cleanup()
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(
            new HttpStatusError(xhr.status, xhr.statusText, xhr.responseText),
          )
          return
        }

        try {
          resolve(normalizeMediaFile(JSON.parse(xhr.responseText)))
        } catch (error) {
          reject(
            error instanceof ProtocolError
              ? error
              : new ProtocolError(
                  "The media file response must be valid JSON.",
                ),
          )
        }
      })
      xhr.addEventListener("error", () => {
        cleanup()
        reject(new TypeError("Network error while uploading file."))
      })
      xhr.addEventListener("abort", () => {
        cleanup()
        reject(
          request.signal.reason ?? new DOMException("Aborted", "AbortError"),
        )
      })

      xhr.open("POST", this.resolveMediaFilesEndpoint())
      for (const [name, value] of headers.entries()) {
        xhr.setRequestHeader(name, value)
      }
      xhr.withCredentials = this.options.credentials === "include"
      request.signal.addEventListener("abort", handleAbort, { once: true })
      xhr.send(body)
    })
  }

  private resolveEndpoint(): string {
    const { api, chatSessionId, threadId } = this.options
    if (chatSessionId && threadId) {
      const base = api.endsWith("/") ? api.slice(0, -1) : api
      return `${base}/chat_sessions/${encodeURIComponent(chatSessionId)}/threads/${encodeURIComponent(threadId)}/invoke`
    }

    return api
  }

  private resolveRateMessageEndpoint(): string {
    const { api, chatSessionId } = this.options
    if (!chatSessionId) {
      throw new Error(
        "A chatSessionId is required to rate a message with PlaiThreadTransport.",
      )
    }

    const base = api.endsWith("/") ? api.slice(0, -1) : api
    return `${base}/chat_sessions/${encodeURIComponent(chatSessionId)}/feedback`
  }

  private resolveTranscriptionEndpoint(): string {
    const { api, chatSessionId } = this.options
    if (!chatSessionId) {
      throw new Error(
        "A chatSessionId is required to transcribe audio with PlaiThreadTransport.",
      )
    }

    const base = api.endsWith("/") ? api.slice(0, -1) : api
    return `${base}/chat_sessions/${encodeURIComponent(chatSessionId)}/transcriptions`
  }

  private resolveMediaFilesEndpoint(): string {
    const { api, chatSessionId, threadId } = this.options
    if (!chatSessionId || !threadId) {
      throw new Error(
        "A chatSessionId and threadId are required to upload files with PlaiThreadTransport.",
      )
    }

    const base = api.endsWith("/") ? api.slice(0, -1) : api
    return `${base}/chat_sessions/${encodeURIComponent(chatSessionId)}/threads/${encodeURIComponent(threadId)}/media-files`
  }

  private createXhr(): XMLHttpRequest {
    if (this.options.xhr) {
      return this.options.xhr()
    }

    if (typeof XMLHttpRequest === "undefined") {
      throw new Error(
        "XMLHttpRequest is required to upload files with progress tracking.",
      )
    }

    return new XMLHttpRequest()
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

function serializeDocument(document: SendMessageDocument) {
  return {
    ...(document.mediaFileId
      ? { media_file_id: document.mediaFileId }
      : { url: document.url }),
    ...(document.filename ? { filename: document.filename } : {}),
  }
}

function normalizeMediaFile(value: unknown): MediaFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProtocolError("The media file response must be an object.")
  }

  const mediaFile = value as Record<string, unknown>
  return {
    id: readRequiredString(mediaFile, "id"),
    name: readRequiredString(mediaFile, "name"),
    pathname: readRequiredString(mediaFile, "pathname"),
    contentType: readRequiredString(mediaFile, "content_type"),
    url: readRequiredString(mediaFile, "url"),
    projectId: readRequiredString(mediaFile, "project_id"),
    threadId: readNullableString(mediaFile.thread_id),
    derivedFromMediaFileId: readNullableString(
      mediaFile.derived_from_media_file_id,
    ),
    anthropicFileId: readNullableString(mediaFile.anthropic_file_id),
    metadata:
      mediaFile.metadata &&
      typeof mediaFile.metadata === "object" &&
      !Array.isArray(mediaFile.metadata)
        ? (mediaFile.metadata as Record<string, unknown>)
        : {},
    ...(typeof mediaFile.created_at === "string"
      ? { createdAt: mediaFile.created_at }
      : {}),
    ...(typeof mediaFile.updated_at === "string"
      ? { updatedAt: mediaFile.updated_at }
      : {}),
  }
}

function readRequiredString(
  value: Record<string, unknown>,
  key: string,
): string {
  const field = value[key]
  if (typeof field !== "string" || field.length === 0) {
    throw new ProtocolError(
      `The media file response is missing the required ${key} field.`,
    )
  }
  return field
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

const AUDIO_FILE_EXTENSIONS: Record<string, string> = {
  "audio/mp3": "mp3",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/mpga": "mpga",
  "audio/m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-m4a": "m4a",
  "audio/webm": "webm",
}

function resolveAudioFilename(audio: Blob): string {
  const mimeType = audio.type.split(";", 1)[0]?.toLowerCase()
  return `recording.${AUDIO_FILE_EXTENSIONS[mimeType] ?? "webm"}`
}

async function safeReadResponseText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ""
  }
}
