import { normalizeError } from "./errors"
import { ProtocolError } from "./errors"
import {
  createInitialInternalState,
  reduceChatState,
  toPublicChatState,
} from "./reducer"
import type {
  ChatState,
  ChatStateListener,
  InputFileMetadata,
  InternalChatState,
  PlaiChatOptions,
  RateMessageInput,
  SendMessageDocument,
  SendMessageInput,
  MediaFile,
  UploadFileOptions,
  UIMessage,
  UIMessagePart,
} from "./types"

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "heic",
  "heif",
  "svg",
])

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

function getDocumentFilename(
  document: SendMessageDocument,
): string | undefined {
  const filename = document.filename?.trim()
  if (filename) {
    return filename
  }

  if (!document.url) {
    return undefined
  }

  try {
    const parsed = new URL(document.url)
    const pathname = decodeURIComponent(parsed.pathname)
    const basename = pathname.split("/").pop()?.trim()
    return basename || undefined
  } catch {
    const cleanedUrl = document.url.split("?")[0]?.split("#")[0] ?? ""
    const basename = cleanedUrl.split("/").pop()?.trim()
    return basename || undefined
  }
}

function getExtension(filename?: string): string | undefined {
  if (!filename) {
    return undefined
  }

  const ext = filename.split(".").pop()?.trim().toLowerCase()
  return ext && ext !== filename.toLowerCase() ? ext : undefined
}

export class PlaiChat {
  private readonly options: PlaiChatOptions

  private readonly listeners = new Set<ChatStateListener>()

  private state: InternalChatState

  private abortController: AbortController | null = null

  private uploadAbortController: AbortController | null = null

  private isStopping = false

  constructor(options: PlaiChatOptions) {
    this.options = options
    this.state = createInitialInternalState(options.initialMessages ?? [])
  }

  getState(): ChatState {
    return toPublicChatState(this.state)
  }

  subscribe(listener: ChatStateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async sendMessage(input: SendMessageInput): Promise<void> {
    if (
      this.state.status !== "ready" ||
      this.state.uploadState.status === "uploading" ||
      this.state.uploadState.status === "processing"
    ) {
      throw new Error(
        "Cannot send a message while another response is in progress.",
      )
    }

    const userMessage = this.createUserMessage(input)
    this.setState({
      ...this.state,
      messages: [...this.state.messages, userMessage],
      status: "submitted",
      error: null,
    })

    const controller = new AbortController()
    this.abortController = controller
    this.isStopping = false

    let didReceiveMessageStop = false

    try {
      for await (const event of this.options.transport.stream({
        messages: this.state.messages,
        message: input,
        signal: controller.signal,
      })) {
        this.options.onEvent?.(event)
        this.setState(reduceChatState(this.state, event))
        if (event.type === "message_stop") {
          didReceiveMessageStop = true
        }
      }

      if (!this.isStopping && !didReceiveMessageStop) {
        throw new ProtocolError(
          "The response stream ended before a message_stop event was received.",
        )
      }
    } catch (error) {
      const normalized = normalizeError(error)
      if (!(this.isStopping && normalized.type === "abort_error")) {
        this.setState({
          ...this.state,
          status: normalized.type === "abort_error" ? "ready" : "error",
          error: normalized.type === "abort_error" ? null : normalized,
        })
        this.options.onError?.(normalized)
      }
    } finally {
      this.abortController = null
      this.isStopping = false
    }
  }

  /** Rate a persisted message in this chat session. */
  async rateMessage(input: RateMessageInput): Promise<void> {
    const rateMessage = this.options.transport.rateMessage
    if (!rateMessage) {
      throw new Error("The configured chat transport does not support message ratings.")
    }

    await rateMessage.call(this.options.transport, input)
  }

  /** Transcribe audio using the authentication context of this chat session. */
  async transcribeAudio(audio: Blob, signal?: AbortSignal): Promise<string> {
    const transcribeAudio = this.options.transport.transcribeAudio
    if (!transcribeAudio) {
      throw new Error(
        "The configured chat transport does not support audio transcription.",
      )
    }

    return transcribeAudio.call(this.options.transport, audio, signal)
  }

  /** Upload a file owned by the current chat thread. */
  async uploadFile(
    file: File,
    options: UploadFileOptions = {},
  ): Promise<MediaFile> {
    const uploadFile = this.options.transport.uploadFile
    if (!uploadFile) {
      throw new Error(
        "The configured chat transport does not support file uploads.",
      )
    }
    if (this.state.status !== "ready") {
      throw new Error("Cannot upload a file while a response is in progress.")
    }
    if (this.uploadAbortController) {
      throw new Error("Cannot upload more than one file at a time.")
    }

    const controller = new AbortController()
    this.uploadAbortController = controller
    const forwardAbort = () => controller.abort(options.signal?.reason)
    if (options.signal?.aborted) {
      forwardAbort()
    } else {
      options.signal?.addEventListener("abort", forwardAbort, { once: true })
    }

    this.setState({
      ...this.state,
      uploadState: {
        status: "uploading",
        fileName: file.name,
        loadedBytes: 0,
        totalBytes: file.size,
        progress: 0,
        error: null,
      },
    })

    try {
      const mediaFile = await uploadFile.call(this.options.transport, {
        file,
        signal: controller.signal,
        onProgress: ({ loadedBytes, totalBytes, progress }) => {
          if (this.uploadAbortController !== controller) return
          this.setState({
            ...this.state,
            uploadState: {
              status: "uploading",
              fileName: file.name,
              loadedBytes,
              totalBytes,
              progress,
              error: null,
            },
          })
        },
        onUploaded: () => {
          if (this.uploadAbortController !== controller) return
          this.setState({
            ...this.state,
            uploadState: {
              status: "processing",
              fileName: file.name,
              loadedBytes: file.size,
              totalBytes: file.size,
              progress: 100,
              error: null,
            },
          })
        },
      })

      this.setState({
        ...this.state,
        uploadState: createIdleUploadState(),
      })
      return mediaFile
    } catch (error) {
      const normalized = normalizeError(error)
      this.setState({
        ...this.state,
        uploadState:
          normalized.type === "abort_error"
            ? createIdleUploadState()
            : {
                status: "error",
                fileName: file.name,
                loadedBytes: this.state.uploadState.loadedBytes,
                totalBytes: this.state.uploadState.totalBytes,
                progress: this.state.uploadState.progress,
                error: normalized,
              },
      })
      throw error
    } finally {
      options.signal?.removeEventListener("abort", forwardAbort)
      if (this.uploadAbortController === controller) {
        this.uploadAbortController = null
      }
    }
  }

  stop(): void {
    if (!this.abortController && !this.uploadAbortController) {
      return
    }

    this.isStopping = this.abortController !== null
    this.abortController?.abort()
    this.uploadAbortController?.abort()
    this.setState({
      ...this.state,
      status: "ready",
      error: null,
      uploadState: createIdleUploadState(),
    })
  }

  /** Replace persisted history when the host refreshes the active thread. */
  hydrate(messages: UIMessage[]): void {
    if (
      this.state.status === "submitted" ||
      this.state.status === "streaming" ||
      this.state.uploadState.status === "uploading" ||
      this.state.uploadState.status === "processing"
    ) {
      throw new Error("Cannot hydrate messages while a response is in progress.")
    }

    this.setState(createInitialInternalState(messages))
  }

  /** Makes an errored conversation sendable again without discarding history. */
  clearError(): void {
    if (this.state.status !== "error") return
    this.setState({
      ...this.state,
      status: "ready",
      error: null,
      didReceiveErrorEvent: false,
    })
  }

  reset(): void {
    this.stop()
    this.setState(
      createInitialInternalState(this.options.initialMessages ?? []),
    )
  }

  private setState(nextState: InternalChatState): void {
    this.state = nextState
    const publicState = toPublicChatState(nextState)
    for (const listener of this.listeners) {
      listener(publicState)
    }
  }

  private createUserMessage(input: SendMessageInput): UIMessage {
    const generateId =
      this.options.generateId ??
      (() =>
        `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`)

    const parts: UIMessagePart[] = []
    for (const document of input.documents ?? []) {
      const filename = getDocumentFilename(document)
      const extension = getExtension(filename)
      const documentUrl = document.url ?? ""
      const metadata: InputFileMetadata | undefined =
        filename || document.mediaFileId
          ? {
              ...(filename ? { originalFileName: filename } : {}),
              ...(document.mediaFileId
                ? { mediaFileId: document.mediaFileId }
                : {}),
            }
          : undefined

      if (extension && IMAGE_EXTENSIONS.has(extension)) {
        parts.push({
          type: "input_image",
          url: documentUrl,
          title: filename,
          metadata,
        })
      } else {
        parts.push({
          type: "input_file",
          fileUrl: documentUrl,
          title: filename,
          mimeType: extension ? MIME_TYPE_BY_EXTENSION[extension] : undefined,
          metadata,
        })
      }
    }

    if (input.text.length > 0) {
      parts.push({
        type: "text",
        text: input.text,
      })
    }

    if (parts.length === 0) {
      parts.push({
        type: "text",
        text: input.text,
      })
    }

    return {
      id: generateId(),
      role: "user",
      parts,
      metadata: {
        createdAt: new Date(),
      },
    }
  }
}

function createIdleUploadState() {
  return {
    status: "idle" as const,
    fileName: null,
    loadedBytes: 0,
    totalBytes: 0,
    progress: 0,
    error: null,
  }
}
