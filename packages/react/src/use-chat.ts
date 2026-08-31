import { PlaiChat } from "@plaisolutions/client"
import type {
  ChatStatus,
  ChatTransport,
  FileUploadState,
  PlaiChatError,
  PlaiSseEvent,
  RateMessageInput,
  ResendMessageInput,
  SendMessageInput,
  TranscribeAudioFn,
  UploadFileFn,
  UIMessage,
  Usage,
} from "@plaisolutions/client"
import { useEffect, useMemo, useRef, useState } from "react"

export type UseChatOptions = {
  transport: ChatTransport
  /** Changes identity when the host switches to a different persisted thread. */
  conversationId?: string
  initialMessages?: UIMessage[]
  generateId?: () => string
  onEvent?: (event: PlaiSseEvent) => void
  onError?: (error: PlaiChatError) => void
}

export type UseChatResult = {
  messages: UIMessage[]
  status: ChatStatus
  error: PlaiChatError | null
  usage: Usage | null
  uploadState: FileUploadState
  sendMessage: (input: SendMessageInput) => Promise<void>
  rateMessage: (input: RateMessageInput) => Promise<void>
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
  const { transport, conversationId } = options

  const chat = useMemo(() => {
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
    })
  }, [conversationId, transport])

  const [state, setState] = useState(() => chat.getState())

  useEffect(() => {
    setState(chat.getState())
    return chat.subscribe(setState)
  }, [chat])

  useEffect(() => {
    return () => {
      chat.stop()
    }
  }, [chat])

  const actions = useMemo(
    () => ({
      sendMessage: chat.sendMessage.bind(chat),
      rateMessage: chat.rateMessage.bind(chat),
      resendMessage: chat.resendMessage.bind(chat),
      transcribeAudio: chat.transcribeAudio.bind(chat),
      uploadFile: chat.uploadFile.bind(chat),
      stop: chat.stop.bind(chat),
      reset: chat.reset.bind(chat),
      hydrate: chat.hydrate.bind(chat),
      clearError: chat.clearError.bind(chat),
    }),
    [chat],
  )

  return {
    messages: state.messages,
    status: state.status,
    error: state.error,
    usage: state.usage,
    uploadState: state.uploadState,
    ...actions,
  }
}
