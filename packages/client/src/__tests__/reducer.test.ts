import { describe, expect, it } from "vitest"

import {
  createInitialInternalState,
  reduceChatState,
  toPublicChatState,
} from "../reducer"
import type { PlaiSseEvent } from "../types"

describe("reduceChatState", () => {
  it("creates assistant message on message_start", () => {
    const next = reduceChatState(createInitialInternalState(), {
      type: "message_start",
      message: {
        id: "msg_1",
        role: "assistant",
        model: "gpt-5.4-mini",
      },
    })

    expect(next.messages).toHaveLength(1)
    expect(next.messages[0].metadata?.model).toBe("gpt-5.4-mini")
  })

  it("accumulates text deltas", () => {
    const events: PlaiSseEvent[] = [
      {
        type: "message_start",
        message: { id: "msg_1", role: "assistant", model: "gpt-5.4-mini" },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "text" },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "Hello" },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "\nworld" },
      },
    ]

    const state = events.reduce(reduceChatState, createInitialInternalState())
    expect(state.messages[0].parts[0]).toEqual({
      type: "text",
      text: "Hello\nworld",
    })
  })

  it("handles tool call lifecycle", () => {
    const events: PlaiSseEvent[] = [
      {
        type: "message_start",
        message: { id: "msg_1", role: "assistant", model: "gpt-5.4-mini" },
      },
      {
        type: "content_block_start",
        index: 1,
        content_block: {
          type: "tool_use",
          id: "toolu_1",
          name: "knowledge_search",
          tool_type: "vector_search",
          input: { query: "hello" },
          input_schema: {},
        },
      },
      {
        type: "tool_result",
        tool_use_id: "toolu_1",
        tool_type: "vector_search",
        content: { result: "ok" },
        is_error: false,
        error_details: null,
        metadata: { latency_ms: 12 },
      },
    ]

    const state = events.reduce(reduceChatState, createInitialInternalState())
    expect(state.messages[0].parts[0]).toMatchObject({
      type: "tool-call",
      state: "completed",
    })
  })

  it("stores guardrail as separate part", () => {
    const events: PlaiSseEvent[] = [
      {
        type: "message_start",
        message: { id: "msg_1", role: "assistant", model: "gpt-5.4-mini" },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "guardrail", content: "Filtered output" },
      },
    ]

    const state = events.reduce(reduceChatState, createInitialInternalState())
    expect(state.messages[0].parts[0]).toEqual({
      type: "guardrail",
      content: "Filtered output",
    })
  })

  it("updates usage globally and per message metadata", () => {
    const events: PlaiSseEvent[] = [
      {
        type: "message_start",
        message: { id: "msg_1", role: "assistant", model: "gpt-5.4-mini" },
      },
      {
        type: "usage",
        input_tokens: 11,
        output_tokens: 22,
        cached_tokens: 3,
      },
    ]

    const state = events.reduce(reduceChatState, createInitialInternalState())

    expect(state.usage).toEqual({
      inputTokens: 11,
      outputTokens: 22,
      cachedTokens: 3,
    })
    expect(state.messages[0].metadata?.usage).toEqual({
      inputTokens: 11,
      outputTokens: 22,
      cachedTokens: 3,
    })
  })

  it("sets persisted message id from message_id", () => {
    const events: PlaiSseEvent[] = [
      {
        type: "message_start",
        message: { id: "msg_1", role: "assistant", model: "gpt-5.4-mini" },
      },
      {
        type: "message_id",
        message_id: "msg_db_123",
      },
    ]

    const state = events.reduce(reduceChatState, createInitialInternalState())

    expect(state.messages[0].metadata?.persistedMessageId).toBe("msg_db_123")
  })

  it("preserves partial content when error happens and stays in error after message_stop", () => {
    const events: PlaiSseEvent[] = [
      {
        type: "message_start",
        message: { id: "msg_1", role: "assistant", model: "gpt-5.4-mini" },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "text" },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "partial" },
      },
      {
        type: "error",
        error: {
          type: "context_length_exceeded",
          message: "Model context length exceeded.",
        },
      },
      {
        type: "message_stop",
      },
    ]

    const state = events.reduce(reduceChatState, createInitialInternalState())

    expect(state.messages[0].parts[0]).toEqual({
      type: "text",
      text: "partial",
    })
    expect(state.status).toBe("error")
  })

  it("returns only public state via toPublicChatState", () => {
    const internal = createInitialInternalState()
    internal.activeAssistantMessageId = "msg_abc"

    const publicState = toPublicChatState(internal)

    expect(publicState).toEqual({
      messages: [],
      status: "ready",
      error: null,
      usage: null,
    })
  })
})
