import { normalizeError } from "./errors"
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
  SendMessageInput,
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

function getDocumentFilename(document: { url: string; filename?: string | null }): string | undefined {
  const filename = document.filename?.trim()
  if (filename) {
    return filename
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
    if (this.state.status !== "ready") {
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

    try {
      for await (const event of this.options.transport.stream({
        messages: this.state.messages,
        message: input,
        signal: controller.signal,
      })) {
        this.options.onEvent?.(event)
        this.setState(reduceChatState(this.state, event))
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

  stop(): void {
    if (!this.abortController) {
      return
    }

    this.isStopping = true
    this.abortController.abort()
    this.setState({
      ...this.state,
      status: "ready",
      error: null,
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
      const metadata: InputFileMetadata | undefined = filename
        ? { originalFileName: filename }
        : undefined

      if (extension && IMAGE_EXTENSIONS.has(extension)) {
        parts.push({
          type: "input_image",
          url: document.url,
          title: filename,
          metadata,
        })
      } else {
        parts.push({
          type: "input_file",
          fileUrl: document.url,
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
