import { ProtocolError } from "./errors"
import type {
  ChatState,
  ContentBlockStartEvent,
  InternalChatState,
  MemoryProposal,
  MemoryProposalEvent,
  PlaiSseEvent,
  UIGuardrailPart,
  UIMessage,
  UIThinkingPart,
  UITextPart,
  UIToolCallPart,
  Usage,
} from "./types"

export function createInitialInternalState(
  initialMessages: UIMessage[] = [],
): InternalChatState {
  return {
    messages: initialMessages,
    status: "ready",
    error: null,
    usage: null,
    uploadState: {
      status: "idle",
      fileName: null,
      loadedBytes: 0,
      totalBytes: 0,
      progress: 0,
      error: null,
    },
    activeAssistantMessageId: undefined,
    blockIndexToPartIndex: {},
    toolUseIdToPartIndex: {},
    didReceiveErrorEvent: false,
  }
}

export function toPublicChatState(state: InternalChatState): ChatState {
  return {
    messages: state.messages,
    status: state.status,
    error: state.error,
    usage: state.usage,
    uploadState: state.uploadState,
  }
}

export function reduceChatState(
  state: InternalChatState,
  event: PlaiSseEvent,
): InternalChatState {
  switch (event.type) {
    case "message_start": {
      const assistantMessage: UIMessage = {
        id: event.message.id,
        role: "assistant",
        parts: [],
        metadata: {
          model: event.message.model,
          createdAt: new Date(),
        },
      }

      return {
        ...state,
        status: "streaming",
        error: null,
        messages: [...state.messages, assistantMessage],
        activeAssistantMessageId: assistantMessage.id,
        blockIndexToPartIndex: {},
        toolUseIdToPartIndex: {},
        didReceiveErrorEvent: false,
      }
    }

    case "content_block_start": {
      return reduceContentBlockStart(state, event)
    }

    case "content_block_delta": {
      const assistantIndex = getActiveAssistantMessageIndex(state)
      const partIndex = state.blockIndexToPartIndex[event.index]

      if (partIndex === undefined) {
        throw new ProtocolError(
          `Received delta for unknown block index ${event.index}.`,
        )
      }

      const message = state.messages[assistantIndex]
      const part = message.parts[partIndex]

      const nextParts = [...message.parts]

      if (part?.type === "text" && event.delta.type === "text_delta") {
        nextParts[partIndex] = {
          ...part,
          text: `${part.text}${event.delta.text}`,
        }
      } else if (
        part?.type === "thinking" &&
        event.delta.type === "thinking_delta"
      ) {
        nextParts[partIndex] = {
          ...part,
          thinking: `${part.thinking}${event.delta.thinking}`,
        }
      } else {
        throw new ProtocolError(
          `Received ${event.delta.type} for incompatible block at index ${event.index}.`,
        )
      }

      return replaceAssistantMessage(state, assistantIndex, {
        ...message,
        parts: nextParts,
      })
    }

    case "content_block_stop": {
      const nextMap = { ...state.blockIndexToPartIndex }
      const partIndex = nextMap[event.index]
      delete nextMap[event.index]

      if (partIndex === undefined) {
        return {
          ...state,
          blockIndexToPartIndex: nextMap,
          status: state.status === "submitted" ? "streaming" : state.status,
        }
      }

      const assistantIndex = getActiveAssistantMessageIndex(state)
      const message = state.messages[assistantIndex]
      const part = message.parts[partIndex]
      const nextParts = [...message.parts]

      if (part?.type === "thinking") {
        nextParts[partIndex] = { ...part, state: "completed" }
      }

      const nextState = replaceAssistantMessage(state, assistantIndex, {
        ...message,
        parts: nextParts,
      })

      return {
        ...nextState,
        blockIndexToPartIndex: nextMap,
        status: state.status === "submitted" ? "streaming" : state.status,
      }
    }

    case "memory_proposal": {
      return reduceMemoryProposal(state, event)
    }

    case "tool_result": {
      const proposal = memoryProposalFromMetadata(event.metadata)
      if (proposal) {
        return reduceMemoryProposal(state, {
          type: "memory_proposal",
          proposal,
        })
      }
      const assistantIndex = getActiveAssistantMessageIndex(state)
      const partIndex = state.toolUseIdToPartIndex[event.tool_use_id]

      if (partIndex === undefined) {
        throw new ProtocolError(
          `No tool-call found for tool_use_id ${event.tool_use_id}.`,
        )
      }

      const message = state.messages[assistantIndex]
      const part = message.parts[partIndex]

      if (!part || part.type !== "tool-call") {
        throw new ProtocolError(
          `Mapped part for ${event.tool_use_id} is not a tool-call.`,
        )
      }

      // The API correlates tool_type with its metadata contract. ToolResultEvent
      // stays generic because it represents every tool result on the wire.
      const nextPart = {
        ...part,
        state: event.is_error ? "error" : "completed",
        result: event.content,
        errorDetails: event.is_error ? event.error_details : null,
        metadata: event.metadata,
      } as UIToolCallPart

      const nextParts = [...message.parts]
      nextParts[partIndex] = nextPart

      return replaceAssistantMessage(state, assistantIndex, {
        ...message,
        parts: nextParts,
      })
    }

    case "message_id": {
      const assistantIndex = getActiveAssistantMessageIndex(state)
      const message = state.messages[assistantIndex]

      return replaceAssistantMessage(state, assistantIndex, {
        ...message,
        metadata: {
          ...message.metadata,
          persistedMessageId: event.message_id,
        },
      })
    }

    case "usage": {
      const usage: Usage = {
        inputTokens: event.input_tokens,
        outputTokens: event.output_tokens,
        cachedTokens: event.cached_tokens,
      }

      const assistantIndex = getActiveAssistantMessageIndex(state)
      const message = state.messages[assistantIndex]
      const nextState = replaceAssistantMessage(state, assistantIndex, {
        ...message,
        metadata: {
          ...message.metadata,
          usage,
        },
      })

      return {
        ...nextState,
        usage,
      }
    }

    case "error": {
      return {
        ...state,
        error: {
          type: event.error.type,
          message: event.error.message,
        },
        status: "error",
        didReceiveErrorEvent: true,
      }
    }

    case "message_stop": {
      return {
        ...state,
        status: state.didReceiveErrorEvent ? "error" : "ready",
        activeAssistantMessageId: undefined,
        blockIndexToPartIndex: {},
        toolUseIdToPartIndex: {},
        didReceiveErrorEvent: false,
      }
    }

    default:
      return state
  }
}

function reduceMemoryProposal(
  state: InternalChatState,
  event: MemoryProposalEvent,
): InternalChatState {
  const assistantIndex = getActiveAssistantMessageIndex(state)
  const message = state.messages[assistantIndex]
  const mappedIndex = state.toolUseIdToPartIndex[event.proposal.tool_call_id]
  const proposalIndex = message.parts.findIndex(
    (part) =>
      part.type === "tool-call" &&
      memoryProposalFromMetadata(part.metadata)?.id === event.proposal.id,
  )
  const partIndex =
    mappedIndex ?? (proposalIndex >= 0 ? proposalIndex : undefined)
  const current = partIndex === undefined ? undefined : message.parts[partIndex]
  const currentProposal =
    current?.type === "tool-call"
      ? memoryProposalFromMetadata(current.metadata)
      : undefined
  const proposal = currentProposal
    ? mergeProposalForDisplay(currentProposal, event.proposal)
    : event.proposal
  const nextPart = {
    type: "tool-call",
    id: event.proposal.tool_call_id,
    name: "propose_memory_change",
    toolType: "memory_proposal",
    input: current?.type === "tool-call" ? current.input : {},
    inputSchema:
      current?.type === "tool-call" ? current.inputSchema : undefined,
    state: "completed",
    metadata: { type: "memory_proposal", proposal },
  } as const
  const nextParts = [...message.parts]
  const nextIndex = partIndex ?? nextParts.length
  if (partIndex === undefined) nextParts.push(nextPart)
  else nextParts[partIndex] = nextPart

  return {
    ...replaceAssistantMessage(state, assistantIndex, {
      ...message,
      parts: nextParts,
    }),
    status: "streaming",
    toolUseIdToPartIndex: {
      ...state.toolUseIdToPartIndex,
      [event.proposal.tool_call_id]: nextIndex,
    },
  }
}

const REDACTED_CONTENT = "[redacted]"

function mergeProposalForDisplay(
  current: MemoryProposal,
  incoming: MemoryProposal,
): MemoryProposal {
  if (current.id !== incoming.id) return incoming
  return {
    ...incoming,
    content:
      incoming.content === REDACTED_CONTENT
        ? current.content
        : incoming.content,
    previous_content:
      incoming.previous_content === REDACTED_CONTENT
        ? current.previous_content
        : incoming.previous_content,
    rationale:
      incoming.rationale === REDACTED_CONTENT
        ? current.rationale
        : incoming.rationale,
  }
}

function memoryProposalFromMetadata(
  metadata: Record<string, unknown> | undefined,
): MemoryProposal | undefined {
  if (metadata?.type !== "memory_proposal") return undefined
  const proposal = metadata.proposal
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    return undefined
  }
  return proposal as MemoryProposal
}

function reduceContentBlockStart(
  state: InternalChatState,
  event: ContentBlockStartEvent,
): InternalChatState {
  const assistantIndex = getActiveAssistantMessageIndex(state)
  const message = state.messages[assistantIndex]

  if (event.content_block.type === "text") {
    const nextParts = [
      ...message.parts,
      { type: "text", text: "" } satisfies UITextPart,
    ]
    return {
      ...replaceAssistantMessage(state, assistantIndex, {
        ...message,
        parts: nextParts,
      }),
      status: "streaming",
      blockIndexToPartIndex: {
        ...state.blockIndexToPartIndex,
        [event.index]: nextParts.length - 1,
      },
    }
  }

  if (event.content_block.type === "thinking") {
    const nextParts = [
      ...message.parts,
      {
        type: "thinking",
        thinking: "",
        state: "streaming",
      } satisfies UIThinkingPart,
    ]
    return {
      ...replaceAssistantMessage(state, assistantIndex, {
        ...message,
        parts: nextParts,
      }),
      status: "streaming",
      blockIndexToPartIndex: {
        ...state.blockIndexToPartIndex,
        [event.index]: nextParts.length - 1,
      },
    }
  }

  if (event.content_block.type === "tool_use") {
    const nextParts = [
      ...message.parts,
      {
        type: "tool-call",
        id: event.content_block.id,
        name: event.content_block.name,
        toolType: event.content_block.tool_type ?? "unknown",
        input: event.content_block.input,
        inputSchema: event.content_block.input_schema,
        state: "pending",
      } as const,
    ]

    return {
      ...replaceAssistantMessage(state, assistantIndex, {
        ...message,
        parts: nextParts,
      }),
      status: "streaming",
      blockIndexToPartIndex: {
        ...state.blockIndexToPartIndex,
        [event.index]: nextParts.length - 1,
      },
      toolUseIdToPartIndex: {
        ...state.toolUseIdToPartIndex,
        [event.content_block.id]: nextParts.length - 1,
      },
    }
  }

  const nextParts = [
    ...message.parts,
    {
      type: "guardrail",
      content: event.content_block.content,
    } satisfies UIGuardrailPart,
  ]
  return {
    ...replaceAssistantMessage(state, assistantIndex, {
      ...message,
      parts: nextParts,
    }),
    status: "streaming",
    blockIndexToPartIndex: {
      ...state.blockIndexToPartIndex,
      [event.index]: nextParts.length - 1,
    },
  }
}

function getActiveAssistantMessageIndex(state: InternalChatState): number {
  const activeId = state.activeAssistantMessageId
  if (!activeId) {
    throw new ProtocolError(
      "No active assistant message for incoming stream event.",
    )
  }

  const index = state.messages.findIndex((message) => message.id === activeId)
  if (index < 0) {
    throw new ProtocolError(
      `Active assistant message ${activeId} not found in state.`,
    )
  }

  return index
}

function replaceAssistantMessage(
  state: InternalChatState,
  assistantIndex: number,
  message: UIMessage,
): InternalChatState {
  const nextMessages = [...state.messages]
  nextMessages[assistantIndex] = message
  return {
    ...state,
    messages: nextMessages,
  }
}
