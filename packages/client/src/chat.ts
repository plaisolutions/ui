import { normalizeError } from "./errors"
import {
  createInitialInternalState,
  reduceChatState,
  toPublicChatState,
} from "./reducer"
import type {
  ChatState,
  ChatStateListener,
  InternalChatState,
  PlaiChatOptions,
  SendMessageInput,
  UIMessage,
} from "./types"

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

    return {
      id: generateId(),
      role: "user",
      parts: [
        {
          type: "text",
          text: input.text,
        },
      ],
      metadata: {
        createdAt: new Date(),
        metadata: input.metadata,
      },
    }
  }
}
