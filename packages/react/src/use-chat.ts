import { PlaiChat } from "@plai/client"
import type {
  ChatStatus,
  ChatTransport,
  PlaiChatError,
  PlaiSseEvent,
  SendMessageInput,
  UIMessage,
  Usage,
} from "@plai/client"
import { useEffect, useMemo, useRef, useState } from "react"

export type UseChatOptions = {
  transport: ChatTransport
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
  sendMessage: (input: SendMessageInput) => Promise<void>
  stop: () => void
  reset: () => void
}

export function useChat(options: UseChatOptions): UseChatResult {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const chat = useMemo(
    () =>
      new PlaiChat({
        transport: options.transport,
        initialMessages: options.initialMessages,
        generateId: options.generateId,
        onEvent: options.onEvent,
        onError: options.onError,
      }),
    [
      options.transport,
      options.initialMessages,
      options.generateId,
      options.onEvent,
      options.onError,
    ],
  )

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

  return {
    messages: state.messages,
    status: state.status,
    error: state.error,
    usage: state.usage,
    sendMessage: chat.sendMessage.bind(chat),
    stop: chat.stop.bind(chat),
    reset: chat.reset.bind(chat),
  }
}
