import { PlaiChat } from "@plaisolutions/client"
import type {
  ChatStatus,
  ChatTransport,
  DecideToolActionsOptions,
  FileUploadState,
  GetToolConfirmationsInput,
  GetResourceDownloadUrlFn,
  GetMemoryProposalFn,
  PlaiChatError,
  PlaiSseEvent,
  RateMessageInput,
  ResolveMemoryProposalFn,
  ResendMessageInput,
  SendMessageInput,
  ToolConfirmationSnapshot,
  ToolDecision,
  TranscribeAudioFn,
  UiActionHandlers,
  UiActionIssue,
  UploadFileFn,
  UIMessage,
  Usage,
} from "@plaisolutions/client"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react"
import { useToolConfirmations } from "./use-tool-confirmations"

type OwnedChatOptions = {
  transport: ChatTransport
  /** Changes identity when the host switches to a different persisted thread. */
  conversationId?: string
  initialMessages?: UIMessage[]
  generateId?: () => string
  onEvent?: (event: PlaiSseEvent) => void
  onError?: (error: PlaiChatError) => void
  /**
   * Handlers of the `ui_action` effects tools declare, by action slug. Read on every effect, so
   * inline objects are fine. The effects stored in `initialMessages` and in `hydrate(...)` are
   * re-applied (flagged `context.replay`).
   */
  uiActionHandlers?: UiActionHandlers
  /** An effect with no handler (`ui_action.unmapped`) or whose handler threw (`ui_action.failed`). */
  onUiActionIssue?: (issue: UiActionIssue) => void
  chat?: never
}

type ExternalChatOptions = {
  /**
   * Instance owned by the host (for example a `ChatRegistry`). The hook only
   * subscribes to it: unmounting never stops its stream.
   */
  chat: PlaiChat
  transport?: never
  conversationId?: never
  initialMessages?: never
  generateId?: never
  onEvent?: never
  onError?: never
  /** Set them on the instance you own: `chat.uiActions.setHandlers(...)`. */
  uiActionHandlers?: never
  onUiActionIssue?: never
}

export type UseChatOptions = OwnedChatOptions | ExternalChatOptions

export type UseChatResult = {
  /** The underlying instance, e.g. for `useToolConfirmationSync`. */
  chat: PlaiChat
  messages: UIMessage[]
  status: ChatStatus
  error: PlaiChatError | null
  usage: Usage | null
  uploadState: FileUploadState
  /** State of the actions awaiting the user's confirmation (cards). */
  toolConfirmations: ToolConfirmationSnapshot
  sendMessage: (input: SendMessageInput) => Promise<void>
  decideToolActions: (
    decisions: ToolDecision[],
    options?: DecideToolActionsOptions,
  ) => Promise<void>
  refreshToolConfirmations: (input?: GetToolConfirmationsInput) => Promise<void>
  rateMessage: (input: RateMessageInput) => Promise<void>
  getMemoryProposal: GetMemoryProposalFn
  acceptMemoryProposal: ResolveMemoryProposalFn
  rejectMemoryProposal: ResolveMemoryProposalFn
  getResourceDownloadUrl: GetResourceDownloadUrlFn
  resendMessage: (input: ResendMessageInput) => Promise<void>
  transcribeAudio: TranscribeAudioFn
  uploadFile: UploadFileFn
  stop: () => void
  reset: () => void
  hydrate: (messages: UIMessage[]) => void
  clearError: () => void
}

export function useChat(options: UseChatOptions): UseChatResult {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const external = options.chat
  const { transport, conversationId } = options

  const owned = useMemo(() => {
    if (external || !transport) return null
    // The explicit identity deliberately creates a new state machine when a
    // host changes persisted threads while reusing the same transport class.
    void conversationId
    return new PlaiChat({
      transport,
      initialMessages: optionsRef.current.initialMessages,
      generateId: () =>
        optionsRef.current.generateId?.() ??
        `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
      onEvent: (event) => optionsRef.current.onEvent?.(event),
      onError: (error) => optionsRef.current.onError?.(error),
      uiActionHandlers: () => optionsRef.current.uiActionHandlers,
      onUiActionIssue: (issue) => optionsRef.current.onUiActionIssue?.(issue),
    })
  }, [external, conversationId, transport])

  const chat = (external ?? owned) as PlaiChat

  const subscribe = useCallback(
    (onStoreChange: () => void) => chat.subscribe(onStoreChange),
    [chat],
  )
  const getSnapshot = useCallback(() => chat.getState(), [chat])
  const getServerSnapshot = useCallback(() => chat.getInitialState(), [chat])
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const toolConfirmations = useToolConfirmations(chat)

  useEffect(() => {
    if (!owned) return
    return () => {
      owned.stop()
    }
  }, [owned])

  // The interface is rebuilt from the saved effects once the host is mounted (never during
  // render or SSR). Effects the stream already applied are skipped by `action_id`.
  useEffect(() => {
    if (!owned) return
    const saved = optionsRef.current.initialMessages
    if (saved?.length) owned.uiActions.replay(saved)
  }, [owned])

  const actions = useMemo(
    () => ({
      sendMessage: chat.sendMessage.bind(chat),
      decideToolActions: chat.decideToolActions.bind(chat),
      refreshToolConfirmations: chat.refreshToolConfirmations.bind(chat),
      rateMessage: chat.rateMessage.bind(chat),
      getMemoryProposal: chat.getMemoryProposal.bind(chat),
      acceptMemoryProposal: chat.acceptMemoryProposal.bind(chat),
      rejectMemoryProposal: chat.rejectMemoryProposal.bind(chat),
      getResourceDownloadUrl: chat.getResourceDownloadUrl.bind(chat),
      resendMessage: chat.resendMessage.bind(chat),
      transcribeAudio: chat.transcribeAudio.bind(chat),
      uploadFile: chat.uploadFile.bind(chat),
      stop: chat.stop.bind(chat),
      reset: chat.reset.bind(chat),
      hydrate: (messages: UIMessage[]) => {
        chat.hydrate(messages)
        chat.uiActions.replay(messages)
      },
      clearError: chat.clearError.bind(chat),
    }),
    [chat],
  )

  return {
    chat,
    messages: state.messages,
    status: state.status,
    error: state.error,
    usage: state.usage,
    uploadState: state.uploadState,
    toolConfirmations,
    ...actions,
  }
}
