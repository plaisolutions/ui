import type {
  InputFileMetadata,
  MemoryProposal,
  ThreadMemoryProposalRef,
  UIMessage,
  UIMessagePart,
  UIToolCallPart,
  UIToolType,
} from "./types"

/**
 * Normalizes messages returned by PLai thread and snapshot endpoints into the
 * public UI model used by {@link PlaiChat}.  The API has had a few historical
 * representations (`content`, `content_parts` and `content_blocks`), so this
 * function deliberately accepts an unknown-shaped record at the boundary.
 */
export function normalizePlaiThreadMessages(
  messages: unknown[],
  options: { memoryProposals?: ThreadMemoryProposalRef[] } = {},
): UIMessage[] {
  const normalized: UIMessage[] = []

  for (const [index, value] of messages.entries()) {
    if (!isRecord(value)) continue

    const role = value.role
    if (role === "tool") {
      const part = toolPartFromLegacyMessage(value, index)
      if (part) {
        normalized.push({
          id: stringValue(value.id) ?? `legacy_tool_${index}`,
          role: "assistant",
          parts: [part],
          metadata: { metadata: { legacyToolMessage: true } },
        })
      }
      continue
    }

    if (role !== "user" && role !== "assistant" && role !== "system") continue

    const parts = partsFromMessage(value)
    normalized.push({
      id: stringValue(value.id) ?? `history_${index}`,
      role,
      parts,
      metadata: metadataFromMessage(value),
    })
  }

  return hydrateMemoryProposalStatuses(
    normalized,
    options.memoryProposals ?? [],
  )
}

function partsFromMessage(message: Record<string, unknown>): UIMessagePart[] {
  const contentBlocks = arrayValue(
    message.content_blocks ?? message.contentBlocks,
  )
  const contentParts = arrayValue(message.content_parts ?? message.contentParts)
  const content = message.content
  const source = contentBlocks.length
    ? contentBlocks
    : contentParts.length
      ? contentParts
      : Array.isArray(content)
        ? content
        : []

  const parts = source.flatMap((part, index) => partFromValue(part, index))
  if (parts.length > 0) return parts

  if (typeof content === "string" && content.length > 0) {
    return [{ type: "text", text: content }]
  }

  return []
}

function partFromValue(value: unknown, index: number): UIMessagePart[] {
  if (!isRecord(value)) return []
  const type = value.type

  if (type === "text") {
    return [
      {
        type: "text",
        text: stringValue(value.text) ?? stringValue(value.content) ?? "",
      },
    ]
  }

  if (type === "guardrail") {
    return [{ type: "guardrail", content: stringValue(value.content) ?? "" }]
  }

  if (type === "thinking") {
    return [
      {
        type: "thinking",
        thinking:
          stringValue(value.content) ??
          stringValue(value.thinking) ??
          stringValue(value.text) ??
          "",
        state: "completed",
      },
    ]
  }

  if (type === "input_image" || type === "image" || type === "image_url") {
    const url = stringValue(value.url) ?? stringValue(value.file_url)
    return url
      ? [
          {
            type: "input_image",
            url,
            title: stringValue(value.title),
            metadata: inputMetadata(
              value.metadata,
              value.media_file_id ?? value.mediaFileId,
            ),
          },
        ]
      : []
  }

  if (type === "input_file" || type === "pdf") {
    const fileUrl = stringValue(value.file_url) ?? stringValue(value.url)
    return fileUrl
      ? [
          {
            type: "input_file",
            fileUrl,
            title: stringValue(value.title),
            mimeType: stringValue(value.mime_type),
            metadata: inputMetadata(
              value.metadata,
              value.media_file_id ?? value.mediaFileId,
            ),
          },
        ]
      : []
  }

  if (type === "tool_use") {
    const info = isRecord(value.tool_info)
      ? value.tool_info
      : isRecord(value.toolInfo)
        ? value.toolInfo
        : value
    const id =
      stringValue(info.id) ?? stringValue(value.id) ?? `history_tool_${index}`
    const metadata = recordValue(info.metadata)
    return [
      {
        type: "tool-call",
        id,
        name: stringValue(info.name) ?? stringValue(value.name) ?? "tool",
        toolType:
          metadata?.type === "memory_proposal"
            ? "memory_proposal"
            : toolType(info.tool_type ?? value.tool_type),
        input: info.input ?? value.input ?? {},
        inputSchema: info.input_schema ?? value.input_schema,
        state:
          info.is_error === true ||
          info.status === "error" ||
          info.status === "failed"
            ? "error"
            : info.status === "executing" || info.status === "pending"
              ? "pending"
              : "completed",
        result: info.result,
        errorDetails: toolErrorDetails(info.error_details),
        metadata,
      } as UIToolCallPart,
    ]
  }

  return []
}

function toolPartFromLegacyMessage(
  message: Record<string, unknown>,
  index: number,
): UIToolCallPart | null {
  const result = recordValue(message.tool_result)
  if (!result) return null
  const metadata = recordValue(result.extra_info)
  return {
    type: "tool-call",
    id: stringValue(result.id) ?? `legacy_tool_call_${index}`,
    name: stringValue(result.name) ?? "tool",
    toolType:
      metadata?.type === "memory_proposal"
        ? "memory_proposal"
        : toolType(result.type),
    input: {},
    state: result.is_error === true ? "error" : "completed",
    result: result.output,
    errorDetails: toolErrorDetails(result.error_details),
    metadata,
  } as UIToolCallPart
}

function hydrateMemoryProposalStatuses(
  messages: UIMessage[],
  refs: ThreadMemoryProposalRef[],
): UIMessage[] {
  if (refs.length === 0) return messages
  const statuses = new Map(refs.map((ref) => [ref.tool_call_id, ref.status]))
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (part.type !== "tool-call") return part
      const proposal = memoryProposalFromMetadata(part.metadata)
      const status = statuses.get(part.id)
      if (!proposal || !status) return part
      return {
        ...part,
        toolType: "memory_proposal",
        state: "completed",
        metadata: {
          ...part.metadata,
          type: "memory_proposal",
          proposal: { ...proposal, status },
        },
      } as UIToolCallPart
    }),
  }))
}

function memoryProposalFromMetadata(
  metadata: Record<string, unknown> | undefined,
): MemoryProposal | undefined {
  if (metadata?.type !== "memory_proposal") return undefined
  const proposal = metadata.proposal
  return isRecord(proposal) ? (proposal as MemoryProposal) : undefined
}

function metadataFromMessage(message: Record<string, unknown>) {
  const createdAt =
    stringValue(message.created_at) ?? stringValue(message.createdAt)
  return {
    model: stringValue(message.model),
    persistedMessageId: stringValue(message.id),
    ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
    ...(isRecord(message.metadata) ? { metadata: message.metadata } : {}),
  }
}

function inputMetadata(
  value: unknown,
  partMediaFileId?: unknown,
): InputFileMetadata | undefined {
  const metadata = recordValue(value)
  const mediaFileId =
    stringValue(partMediaFileId) ??
    stringValue(metadata?.media_file_id) ??
    stringValue(metadata?.mediaFileId)
  if (!metadata && !mediaFileId) return undefined
  return {
    ...metadata,
    originalFileName:
      stringValue(metadata?.original_file_name) ??
      stringValue(metadata?.originalFileName),
    sourceUrl:
      stringValue(metadata?.source_url) ?? stringValue(metadata?.sourceUrl),
    wasConverted:
      booleanValue(metadata?.was_converted) ??
      booleanValue(metadata?.wasConverted),
    convertedFromExtension:
      stringValue(metadata?.converted_from_extension) ??
      stringValue(metadata?.convertedFromExtension),
    mediaFileId,
  }
}

function toolType(value: unknown): UIToolType | "unknown" {
  return typeof value === "string" ? (value as UIToolType) : "unknown"
}

function toolErrorDetails(value: unknown) {
  return typeof value === "string" || isRecord(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined
}
