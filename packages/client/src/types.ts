export type Usage = {
  inputTokens: number
  outputTokens: number
  cachedTokens: number | null
}

export type UIMessageMetadata = {
  model?: string
  persistedMessageId?: string
  usage?: Usage
  createdAt?: Date
  metadata?: Record<string, unknown>
}

export type UITextPart = {
  type: "text"
  text: string
}

export type UIToolCallPart = {
  type: "tool-call"
  id: string
  name: string
  toolType?: string | null
  input: unknown
  inputSchema?: unknown
  state: "pending" | "completed" | "error"
  result?: unknown
  errorDetails?: string | null
  metadata?: Record<string, unknown>
}

export type UIGuardrailPart = {
  type: "guardrail"
  content: string
}

export type UIMessagePart = UITextPart | UIToolCallPart | UIGuardrailPart

export type UIMessage = {
  id: string
  role: "user" | "assistant" | "system"
  parts: UIMessagePart[]
  metadata?: UIMessageMetadata
}

export type ChatStatus = "ready" | "submitted" | "streaming" | "error"

export type PlaiChatError = {
  type:
    | "context_length_exceeded"
    | "llm_error"
    | "http_error"
    | "internal_error"
    | "network_error"
    | "abort_error"
    | "protocol_error"
  message: string
  cause?: unknown
}

export type ChatState = {
  messages: UIMessage[]
  status: ChatStatus
  error: PlaiChatError | null
  usage: Usage | null
}

export type ChatStateListener = (state: ChatState) => void

export type SendMessageInput = {
  text: string
  enabledTools?: string[]
  documents?: Array<{ url: string; filename?: string | null }>
  metadata?: Record<string, unknown>
}

export type ChatTransportRequest = {
  messages: UIMessage[]
  message: SendMessageInput
  signal: AbortSignal
}

export interface ChatTransport {
  stream(request: ChatTransportRequest): AsyncIterable<PlaiSseEvent>
}

export type MessageStartEvent = {
  type: "message_start"
  message: {
    id: string
    role: "assistant"
    model: string
  }
}

export type ContentBlockStartTextEvent = {
  type: "content_block_start"
  index: number
  content_block: {
    type: "text"
  }
}

export type ContentBlockStartToolUseEvent = {
  type: "content_block_start"
  index: number
  content_block: {
    type: "tool_use"
    id: string
    name: string
    tool_type?: string | null
    input: unknown
    input_schema?: unknown
  }
}

export type ContentBlockStartGuardrailEvent = {
  type: "content_block_start"
  index: number
  content_block: {
    type: "guardrail"
    content: string
  }
}

export type ContentBlockStartEvent =
  | ContentBlockStartTextEvent
  | ContentBlockStartToolUseEvent
  | ContentBlockStartGuardrailEvent

export type ContentBlockDeltaEvent = {
  type: "content_block_delta"
  index: number
  delta: {
    type: "text_delta"
    text: string
  }
}

export type ContentBlockStopEvent = {
  type: "content_block_stop"
  index: number
}

export type ToolResultEvent = {
  type: "tool_result"
  tool_use_id: string
  tool_type?: string | null
  content: unknown
  is_error: boolean
  error_details: string | null
  metadata: Record<string, unknown>
}

export type MessageIdEvent = {
  type: "message_id"
  message_id: string
}

export type UsageEvent = {
  type: "usage"
  input_tokens: number
  output_tokens: number
  cached_tokens: number | null
}

export type MessageStopEvent = {
  type: "message_stop"
}

export type StreamErrorType =
  | "context_length_exceeded"
  | "llm_error"
  | "http_error"
  | "internal_error"

export type StreamErrorEvent = {
  type: "error"
  error: {
    type: StreamErrorType
    message: string
  }
}

export type PlaiSseEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | ToolResultEvent
  | MessageIdEvent
  | UsageEvent
  | MessageStopEvent
  | StreamErrorEvent

export type PlaiChatOptions = {
  transport: ChatTransport
  initialMessages?: UIMessage[]
  generateId?: () => string
  onEvent?: (event: PlaiSseEvent) => void
  onError?: (error: PlaiChatError) => void
}

export type InternalChatState = ChatState & {
  activeAssistantMessageId?: string
  blockIndexToPartIndex: Record<number, number>
  toolUseIdToPartIndex: Record<string, number>
  didReceiveErrorEvent: boolean
}
