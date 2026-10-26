import type { PlaiChat } from "./chat"
import type { StreamCoordinator } from "./coordinator"
import { normalizeError } from "./errors"
import type {
  ChatState,
  MediaFile,
  PlaiChatError,
  PlaiSseEvent,
  ResendMessageInput,
  SendMessageInput,
  UploadFileOptions,
} from "./types"

export type ChatRegistryErrorCode =
  | "capacity_exceeded"
  | "operation_in_progress"
  | "cancelled"
  | "disposed"

/** Identifiable rejection of a registry operation. */
export class ChatRegistryError extends Error {
  readonly code: ChatRegistryErrorCode

  constructor(code: ChatRegistryErrorCode, message: string) {
    super(message)
    this.name = "ChatRegistryError"
    this.code = code
  }
}

export type ChatRegistryHooks = {
  onEvent: (event: PlaiSseEvent) => void
  onError: (error: PlaiChatError) => void
}

export type ChatRegistryOptions = {
  /** Builds the instance of a key. Pass `hooks` to the `PlaiChat` constructor. */
  create: (key: string, hooks: ChatRegistryHooks) => PlaiChat
  /** Shared by every registry of the host. */
  coordinator: StreamCoordinator
  /** Idle instances kept besides the retained or busy ones. Default 20. */
  maxIdle?: number
  /** Receives exceptions thrown by listeners. Defaults to `console.error`. */
  onListenerError?: (error: unknown) => void
}

/** Context handed to an invocation. Each invocation may send only once. */
export type ChatInvocation = {
  readonly invocationId: string
  /** Aborted when the invocation is cancelled or its entry is released. */
  readonly signal: AbortSignal
  uploadFile: (file: File, options?: UploadFileOptions) => Promise<MediaFile>
  sendMessage: (input: SendMessageInput) => Promise<void>
  resendMessage: (input: ResendMessageInput) => Promise<void>
}

export type ChatInvocationOutcome = "completed" | "error" | "cancelled"

export type ChatInvocationSettled = {
  invocationId: string
  outcome: ChatInvocationOutcome
  error: PlaiChatError | null
  /** Whether the invocation reached the send step. */
  didSend: boolean
  /** Final state, already reduced. */
  state: ChatState
}

type Operation = {
  id: string
  controller: AbortController
  didSend: boolean
}

type Entry = {
  key: string
  chat: PlaiChat
  retains: number
  /** Handed out by `getOrCreate` and not retained yet: never evicted. */
  pendingRetain: boolean
  operation: Operation | null
  removed: boolean
  lastUsed: number
  unsubscribe: () => void
}

const EMPTY_KEYS: ReadonlySet<string> = new Set()

let invocationCounter = 0

function createInvocationId(): string {
  invocationCounter += 1
  return `inv_${Date.now().toString(36)}_${invocationCounter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function isChatStateBusy(state: ChatState): boolean {
  return (
    state.status === "submitted" ||
    state.status === "streaming" ||
    state.uploadState.status === "uploading" ||
    state.uploadState.status === "processing"
  )
}

function abortError(): DOMException {
  return new DOMException("The invocation was cancelled.", "AbortError")
}

/**
 * Owns the `PlaiChat` instances of a chat session, keyed by thread.
 *
 * Instances outlive the components that render them: unmounting a consumer
 * never stops a stream. Sending goes through `runInvocation`, which owns the
 * whole operation (uploads + send) and its slot in the shared coordinator.
 */
export class ChatRegistry {
  private readonly options: ChatRegistryOptions

  private readonly maxIdle: number

  private readonly entries = new Map<string, Entry>()

  /** Instances handed out after `dispose`, so consumers keep a stable identity. */
  private readonly detached = new Map<string, PlaiChat>()

  private readonly listeners = new Set<() => void>()

  private readonly eventListeners = new Set<
    (key: string, event: PlaiSseEvent) => void
  >()

  private readonly errorListeners = new Set<
    (key: string, error: PlaiChatError) => void
  >()

  private readonly settledListeners = new Set<
    (key: string, result: ChatInvocationSettled) => void
  >()

  private busySnapshot: ReadonlySet<string> = EMPTY_KEYS

  private disposed = false

  private evictionScheduled = false

  private clock = 0

  constructor(options: ChatRegistryOptions) {
    const maxIdle = options.maxIdle ?? 20
    if (!Number.isInteger(maxIdle) || maxIdle < 0) {
      throw new RangeError("maxIdle must be a non-negative integer.")
    }
    this.options = options
    this.maxIdle = maxIdle
  }

  get coordinator(): StreamCoordinator {
    return this.options.coordinator
  }

  isDisposed(): boolean {
    return this.disposed
  }

  /**
   * Returns the instance of `key`, creating it if needed. Safe to call during
   * render: it never notifies listeners and never evicts what it returns.
   */
  getOrCreate(key: string): PlaiChat {
    if (this.disposed) return this.getDetached(key)

    const existing = this.entries.get(key)
    if (existing) {
      existing.lastUsed = this.tick()
      if (existing.retains === 0) existing.pendingRetain = true
      return existing.chat
    }

    const entry = this.createEntry(key)
    this.entries.set(key, entry)
    this.scheduleEviction()
    return entry.chat
  }

  get(key: string): PlaiChat | undefined {
    return this.entries.get(key)?.chat
  }

  has(key: string): boolean {
    return this.entries.has(key)
  }

  /** Keeps `key` resident. The cleanup only drops this retention. */
  retain(key: string): () => void {
    if (this.disposed) return () => {}
    const entry = this.entries.get(key) ?? this.adoptMissing(key)
    entry.retains += 1
    entry.pendingRetain = false
    entry.lastUsed = this.tick()

    let done = false
    return () => {
      if (done) return
      done = true
      if (entry.removed) return
      entry.retains -= 1
      entry.lastUsed = this.tick()
      this.scheduleEviction()
    }
  }

  /**
   * Runs a send operation on `key`. Admission (no other operation on the key,
   * a free slot in the coordinator) is decided synchronously before the first
   * `await`. The slot and the retention last until the returned promise
   * settles, whatever the component tree does meanwhile.
   */
  runInvocation<T>(
    key: string,
    operation: (invocation: ChatInvocation) => Promise<T>,
  ): Promise<T> {
    if (this.disposed) {
      return Promise.reject(
        new ChatRegistryError("disposed", "The chat registry was disposed."),
      )
    }

    const entry = this.entries.get(key) ?? this.createAndStore(key)
    if (entry.operation || isChatStateBusy(entry.chat.getState())) {
      return Promise.reject(
        new ChatRegistryError(
          "operation_in_progress",
          "This conversation already has an operation in progress.",
        ),
      )
    }

    const releaseSlot = this.options.coordinator.tryAcquire()
    if (!releaseSlot) {
      return Promise.reject(
        new ChatRegistryError(
          "capacity_exceeded",
          "Too many conversations are responding at the same time.",
        ),
      )
    }

    const current: Operation = {
      id: createInvocationId(),
      controller: new AbortController(),
      didSend: false,
    }
    entry.operation = current
    entry.retains += 1
    entry.pendingRetain = false
    entry.lastUsed = this.tick()
    this.refreshBusy()

    return this.execute(entry, current, operation, releaseSlot)
  }

  /** Cancels the local operation of `key` and stops its stream. Idempotent. */
  cancel(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    entry.operation?.controller.abort()
    entry.chat.stop()
  }

  /** Cancels and removes `key`. Idempotent. */
  release(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    this.removeEntry(entry)
    this.refreshBusy(true)
  }

  /** Keys with an operation, a stream or an upload in progress. */
  busyKeys(): ReadonlySet<string> {
    return this.busySnapshot
  }

  /** Notified when busy keys change or entries are removed. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  onEvent(listener: (key: string, event: PlaiSseEvent) => void): () => void {
    this.eventListeners.add(listener)
    return () => {
      this.eventListeners.delete(listener)
    }
  }

  onError(listener: (key: string, error: PlaiChatError) => void): () => void {
    this.errorListeners.add(listener)
    return () => {
      this.errorListeners.delete(listener)
    }
  }

  /** Called once per invocation, with the final state, before resources are freed. */
  onSettled(
    listener: (key: string, result: ChatInvocationSettled) => void,
  ): () => void {
    this.settledListeners.add(listener)
    return () => {
      this.settledListeners.delete(listener)
    }
  }

  /** Cancels and removes every entry of this registry. The coordinator is untouched. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const entry of [...this.entries.values()]) {
      this.removeEntry(entry)
    }
    this.refreshBusy(true)
  }

  private async execute<T>(
    entry: Entry,
    current: Operation,
    operation: (invocation: ChatInvocation) => Promise<T>,
    releaseSlot: () => void,
  ): Promise<T> {
    const { chat } = entry
    const { signal } = current.controller

    const assertActive = () => {
      if (signal.aborted || entry.removed || entry.operation !== current) {
        throw abortError()
      }
    }

    const claimSend = () => {
      assertActive()
      if (current.didSend) {
        throw new Error("An invocation can only send one message.")
      }
      current.didSend = true
    }

    const invocation: ChatInvocation = {
      invocationId: current.id,
      signal,
      uploadFile: async (file, options = {}) => {
        assertActive()
        const combined = combineSignals(signal, options.signal)
        try {
          const mediaFile = await chat.uploadFile(file, {
            ...options,
            signal: combined.signal,
          })
          assertActive()
          return mediaFile
        } finally {
          combined.dispose()
        }
      },
      sendMessage: async (input) => {
        claimSend()
        await chat.sendMessage(input)
      },
      resendMessage: async (input) => {
        claimSend()
        await chat.resendMessage(input)
      },
    }

    let settled: ChatInvocationSettled
    let value: T | undefined
    let thrown: unknown
    let didThrow = false

    try {
      value = await operation(invocation)
    } catch (error) {
      didThrow = true
      thrown = error
    }

    try {
      const state = chat.getState()
      if (signal.aborted || entry.removed) {
        settled = {
          invocationId: current.id,
          outcome: "cancelled",
          error: null,
          didSend: current.didSend,
          state,
        }
      } else if (didThrow) {
        settled = {
          invocationId: current.id,
          outcome: "error",
          error: normalizeError(thrown),
          didSend: current.didSend,
          state,
        }
      } else if (current.didSend && state.status === "error") {
        // sendMessage resolves even when the stream ended with an error.
        settled = {
          invocationId: current.id,
          outcome: "error",
          error: state.error,
          didSend: true,
          state,
        }
      } else {
        settled = {
          invocationId: current.id,
          outcome: "completed",
          error: null,
          didSend: current.didSend,
          state,
        }
      }

      for (const listener of this.settledListeners) {
        this.safely(() => listener(entry.key, settled))
      }
    } finally {
      if (entry.operation === current) entry.operation = null
      if (!entry.removed) {
        entry.retains -= 1
        entry.lastUsed = this.tick()
      }
      releaseSlot()
      this.refreshBusy()
      this.scheduleEviction()
    }

    if (didThrow) throw thrown
    return value as T
  }

  private createEntry(key: string): Entry {
    const entry: Entry = {
      key,
      chat: undefined as unknown as PlaiChat,
      retains: 0,
      pendingRetain: true,
      operation: null,
      removed: false,
      lastUsed: this.tick(),
      unsubscribe: () => {},
    }

    entry.chat = this.options.create(key, {
      onEvent: (event) => {
        if (entry.removed) return
        for (const listener of this.eventListeners) {
          this.safely(() => listener(key, event))
        }
      },
      onError: (error) => {
        if (entry.removed) return
        for (const listener of this.errorListeners) {
          this.safely(() => listener(key, error))
        }
      },
    })
    entry.unsubscribe = entry.chat.subscribe(() => {
      if (!entry.removed) this.refreshBusy()
    })
    return entry
  }

  private createAndStore(key: string): Entry {
    const entry = this.createEntry(key)
    this.entries.set(key, entry)
    return entry
  }

  /** `retain` on a key evicted or released meanwhile: recreate and notify. */
  private adoptMissing(key: string): Entry {
    const entry = this.createAndStore(key)
    this.emit()
    return entry
  }

  private getDetached(key: string): PlaiChat {
    let chat = this.detached.get(key)
    if (!chat) {
      chat = this.options.create(key, { onEvent: () => {}, onError: () => {} })
      this.detached.set(key, chat)
    }
    return chat
  }

  private removeEntry(entry: Entry): void {
    if (entry.removed) return
    entry.removed = true
    entry.operation?.controller.abort()
    entry.chat.stop()
    entry.unsubscribe()
    this.entries.delete(entry.key)
  }

  private scheduleEviction(): void {
    if (this.evictionScheduled || this.disposed) return
    this.evictionScheduled = true
    // Deferred so a synchronous retain → release → retain (StrictMode) or a
    // render that has not committed yet never loses its instance.
    queueMicrotask(() => {
      this.evictionScheduled = false
      this.evict()
    })
  }

  private evict(): void {
    if (this.disposed) return
    const idle = [...this.entries.values()].filter(
      (entry) =>
        entry.retains === 0 &&
        !entry.pendingRetain &&
        !entry.operation &&
        !isChatStateBusy(entry.chat.getState()),
    )
    if (idle.length <= this.maxIdle) return

    idle.sort((a, b) => a.lastUsed - b.lastUsed)
    for (const entry of idle.slice(0, idle.length - this.maxIdle)) {
      this.removeEntry(entry)
    }
    this.emit()
  }

  private refreshBusy(forceEmit = false): void {
    const next = new Set<string>()
    for (const entry of this.entries.values()) {
      if (entry.operation || isChatStateBusy(entry.chat.getState())) {
        next.add(entry.key)
      }
    }

    const previous = this.busySnapshot
    const changed =
      next.size !== previous.size || [...next].some((key) => !previous.has(key))
    if (changed) this.busySnapshot = next.size === 0 ? EMPTY_KEYS : next
    if (changed || forceEmit) this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) {
      this.safely(listener)
    }
  }

  private safely(callback: () => void): void {
    try {
      callback()
    } catch (error) {
      ;(this.options.onListenerError ?? console.error)(error)
    }
  }

  private tick(): number {
    this.clock += 1
    return this.clock
  }
}

function combineSignals(
  primary: AbortSignal,
  secondary: AbortSignal | undefined,
): { signal: AbortSignal; dispose: () => void } {
  if (!secondary) return { signal: primary, dispose: () => {} }

  const controller = new AbortController()
  const abort = () => controller.abort()
  if (primary.aborted || secondary.aborted) {
    abort()
  } else {
    primary.addEventListener("abort", abort, { once: true })
    secondary.addEventListener("abort", abort, { once: true })
  }
  return {
    signal: controller.signal,
    dispose: () => {
      primary.removeEventListener("abort", abort)
      secondary.removeEventListener("abort", abort)
    },
  }
}
