import { ProtocolError } from "./errors"
import type {
  ChatState,
  ContentBlockStartEvent,
  InternalChatState,
  PlaiSseEvent,
  UIGuardrailPart,
  UIMessage,
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

      if (!part || part.type !== "text") {
        throw new ProtocolError(
          `Received text delta for non-text block at index ${event.index}.`,
        )
      }

      const nextParts = [...message.parts]
      nextParts[partIndex] = {
        ...part,
        text: `${part.text}${event.delta.text}`,
      }

      return replaceAssistantMessage(state, assistantIndex, {
        ...message,
        parts: nextParts,
      })
    }

    case "content_block_stop": {
      const nextMap = { ...state.blockIndexToPartIndex }
      delete nextMap[event.index]

      return {
        ...state,
        blockIndexToPartIndex: nextMap,
        status: state.status === "submitted" ? "streaming" : state.status,
      }
    }

    case "tool_result": {
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

      const nextPart: UIToolCallPart = {
        ...part,
        state: event.is_error ? "error" : "completed",
        result: event.content,
        errorDetails: event.is_error ? event.error_details : null,
        metadata: event.metadata,
      }

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

  if (event.content_block.type === "tool_use") {
    const nextParts = [
      ...message.parts,
      {
        type: "tool-call",
        id: event.content_block.id,
        name: event.content_block.name,
        toolType: event.content_block.tool_type,
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
