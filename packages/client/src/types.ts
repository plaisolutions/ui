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

export type InputFileMetadata = {
  sourceUrl?: string
  wasConverted?: boolean
  originalFileName?: string
  convertedFromExtension?: string
  [key: string]: unknown
}

export type UIInputFilePart = {
  type: "input_file"
  fileUrl: string
  title?: string
  mimeType?: string
  metadata?: InputFileMetadata
}

export type UIInputImagePart = {
  type: "input_image"
  url: string
  title?: string
  metadata?: InputFileMetadata
}

export type OfficeDocumentMediaFile = {
  id: string
  name?: string
  content_type?: string
  url?: string
  pathname?: string
  anthropic_file_id?: string
  project_id?: string
  metadata?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export type OfficeDocumentsToolMetadata = {
  type?: "office_documents" | string
  media_files?: OfficeDocumentMediaFile[]
  media_file_ids?: string[]
  anthropic_file_ids?: string[]
  [key: string]: unknown
}

export type DocumentMetadata = {
  id?: string
  resource_id?: string
  datasource_id?: string
  [key: string]: unknown
}

export type FolderReadModel = {
  id: string
  name: string
  parent_id: string | null
  datasource_id: string
  extra_info: Record<string, unknown>
  created_at: string
  updated_at: string
  parent: FolderReadModel | null
}

export type DatasourceReadModel = {
  id: string
  name: string
  description: string | null
  summary: string | null
  type: string
  source: string
  metadata_schema: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type ResourceReadModel = {
  id: string
  name: string
  type: string
  status: string
  url: string | null
  content: string | null
  metadata: Record<string, string | number | boolean>
  extra_info: Record<string, unknown>
  folder: FolderReadModel | null
  datasource: DatasourceReadModel | null
  external_url: string | null
  external_resource_id: string | null
  store: boolean
  created_at: string
  updated_at: string
}

export type DatasourceToolResultMetadata = {
  documents_metadata: DocumentMetadata[]
  chunk_ids: string[] | null
  relevance_scores: number[] | null
  resources: ResourceReadModel[]
  [key: string]: unknown
}

export type ToolErrorDetails = string | Record<string, unknown>

export type DatasourceToolErrorMetadata = {
  type?: string
  error_details?: ToolErrorDetails | null
  documents_metadata?: never
  chunk_ids?: never
  relevance_scores?: never
  resources?: never
  [key: string]: unknown
}

export type WebSearchResult = {
  title: string
  url: string
  date?: string | null
  last_updated?: string | null
  snippet?: string | null
  source?: string | null
  markdown?: string | null
  image_url?: string | null
}

export type PerplexityToolResultMetadata = {
  type?: "perplexity"
  search_results?: WebSearchResult[] | null
  prompt_tokens?: number
  completion_tokens?: number
  citation_tokens?: number | null
  num_search_queries?: number | null
  citations?: string[]
  [key: string]: unknown
}

export type FirecrawlSearchToolResultMetadata = {
  type?: "firecrawl_search"
  search_results?: WebSearchResult[]
  credits?: number | null
  results_count?: number | null
  sources?: string[]
  [key: string]: unknown
}

export type ExternalDatasourceJsonTable =
  | string
  | Record<string, unknown>
  | Array<Record<string, unknown>>

export type ExternalDatasourceToolResultMetadata = {
  type?: "external_datasource"
  sql_query?: string
  json_table?: ExternalDatasourceJsonTable | null
  prompt_tokens?: number
  completion_tokens?: number
  [key: string]: unknown
}

export type UIToolCallMetadata =
  | OfficeDocumentsToolMetadata
  | DatasourceToolResultMetadata
  | ExternalDatasourceToolResultMetadata
  | PerplexityToolResultMetadata
  | FirecrawlSearchToolResultMetadata
  | Record<string, unknown>

export type UIToolType =
  | "agent_invocation"
  | "browser"
  | "datasource"
  | "email_send"
  | "external_datasource"
  | "firecrawl_search"
  | "http_request"
  | "mcp_tool"
  | "office_documents"
  | "perplexity"
  | "structured_datasource"
  | "workflow_dispatch"
  | "unknown"

export type UIBaseToolCallPart<
  TToolType extends UIToolType | null = UIToolType | null,
  TMetadata extends UIToolCallMetadata = UIToolCallMetadata,
> = {
  type: "tool-call"
  id: string
  name: string
  toolType: TToolType
  input: unknown
  inputSchema?: unknown
  state: "pending" | "completed" | "error"
  result?: unknown
  errorDetails?: ToolErrorDetails | null
  metadata?: TMetadata
}

export type UIAgentInvocationToolCallPart =
  UIBaseToolCallPart<"agent_invocation">
export type UIBrowserToolCallPart = UIBaseToolCallPart<"browser">
export type UIDatasourceToolCallPart = UIBaseToolCallPart<
  "datasource",
  DatasourceToolResultMetadata | DatasourceToolErrorMetadata
>
export type UIEmailSendToolCallPart = UIBaseToolCallPart<"email_send">
export type UIExternalDatasourceToolCallPart = UIBaseToolCallPart<
  "external_datasource",
  ExternalDatasourceToolResultMetadata
>
export type UIFirecrawlSearchToolCallPart = UIBaseToolCallPart<
  "firecrawl_search",
  FirecrawlSearchToolResultMetadata
>
export type UIHttpRequestToolCallPart = UIBaseToolCallPart<"http_request">
export type UIMcpToolCallPart = UIBaseToolCallPart<"mcp_tool">
export type UIOfficeDocumentsToolCallPart = UIBaseToolCallPart<
  "office_documents",
  OfficeDocumentsToolMetadata
>
export type UIPerplexityToolCallPart = UIBaseToolCallPart<
  "perplexity",
  PerplexityToolResultMetadata
>
export type UIStructuredDatasourceToolCallPart =
  UIBaseToolCallPart<"structured_datasource">
export type UIWorkflowDispatchToolCallPart =
  UIBaseToolCallPart<"workflow_dispatch">
export type UIUnknownToolCallPart = Omit<
  UIBaseToolCallPart<"unknown" | null>,
  "toolType"
> & {
  toolType?: "unknown" | null
}

export type UIToolCallPart =
  | UIAgentInvocationToolCallPart
  | UIBrowserToolCallPart
  | UIDatasourceToolCallPart
  | UIEmailSendToolCallPart
  | UIExternalDatasourceToolCallPart
  | UIFirecrawlSearchToolCallPart
  | UIHttpRequestToolCallPart
  | UIMcpToolCallPart
  | UIOfficeDocumentsToolCallPart
  | UIPerplexityToolCallPart
  | UIStructuredDatasourceToolCallPart
  | UIWorkflowDispatchToolCallPart
  | UIUnknownToolCallPart

export type UIGuardrailPart = {
  type: "guardrail"
  content: string
}

export type UIMessagePart =
  | UITextPart
  | UIInputFilePart
  | UIInputImagePart
  | UIToolCallPart
  | UIGuardrailPart

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
    tool_type?: UIToolType | null
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
  tool_type?: UIToolType | null
  content: unknown
  is_error: boolean
  error_details: ToolErrorDetails | null
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
