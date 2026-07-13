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
          tool_type: "datasource",
          input: { query: "hello" },
          input_schema: {},
        },
      },
      {
        type: "tool_result",
        tool_use_id: "toolu_1",
        tool_type: "datasource",
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

  it("defaults missing tool_type to unknown", () => {
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
          id: "toolu_unknown_1",
          name: "some_tool",
          input: { q: "hello" },
          input_schema: {},
        },
      },
    ]

    const state = events.reduce(reduceChatState, createInitialInternalState())
    expect(state.messages[0].parts[0]).toMatchObject({
      type: "tool-call",
      toolType: "unknown",
      state: "pending",
    })
  })

  it("preserves office_documents metadata inside tool-call parts", () => {
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
          id: "toolu_office_1",
          name: "office_documents",
          tool_type: "office_documents",
          input: { query: "Create a report" },
          input_schema: {},
        },
      },
      {
        type: "tool_result",
        tool_use_id: "toolu_office_1",
        tool_type: "office_documents",
        content: { status: "ok" },
        is_error: false,
        error_details: null,
        metadata: {
          type: "office_documents",
          media_files: [
            {
              id: "mf_1",
              name: "report.docx",
              url: "https://example.com/report.docx",
            },
          ],
          media_file_ids: ["mf_1"],
          anthropic_file_ids: ["file_abc"],
        },
      },
    ]

    const state = events.reduce(reduceChatState, createInitialInternalState())
    expect(state.messages[0].parts[0]).toMatchObject({
      type: "tool-call",
      toolType: "office_documents",
      state: "completed",
      metadata: {
        type: "office_documents",
        media_file_ids: ["mf_1"],
        anthropic_file_ids: ["file_abc"],
      },
    })
  })

  it("preserves datasource resources inside tool-call metadata", () => {
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
          id: "toolu_datasource_1",
          name: "actua_learn_content",
          tool_type: "datasource",
          input: { question: "Storyline" },
          input_schema: {},
        },
      },
      {
        type: "tool_result",
        tool_use_id: "toolu_datasource_1",
        tool_type: "datasource",
        content: "found it",
        is_error: false,
        error_details: null,
        metadata: {
          documents_metadata: [{ id: "chunk-1", resource_id: "resource-1" }],
          chunk_ids: null,
          relevance_scores: null,
          resources: [{ id: "resource-1", name: "Storyline course" }],
        },
      },
    ]

    const state = events.reduce(reduceChatState, createInitialInternalState())
    expect(state.messages[0].parts[0]).toMatchObject({
      type: "tool-call",
      toolType: "datasource",
      state: "completed",
      metadata: {
        resources: [{ id: "resource-1", name: "Storyline course" }],
      },
    })
  })

  it("preserves structured tool error details", () => {
    const errorDetails = {
      error_type: "ProgrammingError",
      error_message: 'column "app_id" does not exist',
    }
    const events: PlaiSseEvent[] = [
      {
        type: "message_start",
        message: { id: "msg_1", role: "assistant", model: "gpt-4.1" },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "tool_use",
          id: "toolu_error_1",
          name: "actua_learn_content",
          tool_type: "datasource",
          input: { question: "Storyline" },
        },
      },
      {
        type: "tool_result",
        tool_use_id: "toolu_error_1",
        tool_type: "datasource",
        content: "Knowledge base search failed.",
        is_error: true,
        error_details: errorDetails,
        metadata: {},
      },
    ]

    const state = events.reduce(reduceChatState, createInitialInternalState())
    expect(state.messages[0].parts[0]).toMatchObject({
      type: "tool-call",
      state: "error",
      errorDetails,
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
