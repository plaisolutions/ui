import { describe, expect, it } from "vitest"
import { PlaiChat } from "../chat"
import { normalizePlaiThreadMessages } from "../history"
import { createInitialInternalState, reduceChatState } from "../reducer"
import { canShowAssistantTurnActions, getAssistantTurnContent } from "../turns"
import type { PlaiSseEvent } from "../types"

const events: PlaiSseEvent[] = [
  {
    type: "message_start",
    message: { id: "live", role: "assistant", model: "test" },
  },
  { type: "content_block_start", index: 0, content_block: { type: "text" } },
  {
    type: "content_block_delta",
    index: 0,
    delta: { type: "text_delta", text: "draft" },
  },
  { type: "content_block_stop", index: 0 },
  {
    type: "content_block_start",
    index: 1,
    content_block: {
      type: "tool_use",
      id: "call",
      name: "search",
      input: {},
      input_schema: {},
      tool_type: "datasource",
    },
  },
  { type: "content_block_stop", index: 1 },
  {
    type: "tool_result",
    tool_use_id: "call",
    tool_type: "datasource",
    content: "found",
    is_error: false,
    error_details: null,
    metadata: {},
  },
  { type: "content_block_start", index: 2, content_block: { type: "text" } },
  {
    type: "content_block_delta",
    index: 2,
    delta: { type: "text_delta", text: "final answer" },
  },
  { type: "content_block_stop", index: 2 },
  { type: "message_id", message_id: "saved" },
  { type: "message_stop" },
]

describe("assistant turn presentation", () => {
  it.each(["legacy", "embedded"])(
    "preserves %s memory proposal metadata and refreshes its status",
    (shape) => {
      const call = {
        type: "tool_use",
        id: "memory",
        name: "propose_memory",
        tool_type: "agent",
        input: { fact: "x" },
      }
      const metadata = {
        type: "memory_proposal",
        proposal: { id: "proposal", status: "PENDING" },
      }
      const result = {
        type: "tool_result",
        tool_use_id: "memory",
        content: "proposed",
        metadata,
      }
      const rows: unknown[] =
        shape === "embedded"
          ? [{ id: "first", role: "assistant", content_parts: [call, result] }]
          : [
              { id: "first", role: "assistant", content_parts: [call] },
              {
                id: "tool-row",
                role: "tool",
                tool_call_id: "memory",
                tool_result: {
                  type: "agent",
                  output: "proposed",
                  extra_info: metadata,
                },
              },
            ]
      rows.push({
        id: "final",
        role: "assistant",
        content_parts: [{ type: "text", text: "answer" }],
      })
      const messages = normalizePlaiThreadMessages(rows)
      expect(messages[0].parts[0]).toMatchObject({
        toolType: "memory_proposal",
        input: { fact: "x" },
        metadata,
      })
      const refreshed = normalizePlaiThreadMessages(rows, {
        memoryProposals: [{ tool_call_id: "memory", status: "ACCEPTED" }],
      })
      expect(refreshed[0].parts[0]).toMatchObject({
        toolType: "memory_proposal",
        metadata: { proposal: { status: "ACCEPTED" } },
      })
      expect(refreshed[0].metadata?.persistedMessageId).toBe("final")
    },
  )

  it("does not reenable actions when a persisted stream is cancelled", async () => {
    let notifyPersisted = () => {}
    const persisted = new Promise<void>((resolve) => {
      notifyPersisted = resolve
    })
    const chat = new PlaiChat({
      transport: {
        async *stream({ signal }) {
          yield* events.slice(0, -1)
          await new Promise<void>((resolve) => {
            if (signal.aborted) resolve()
            else
              signal.addEventListener("abort", () => resolve(), { once: true })
          })
          throw new DOMException("Aborted", "AbortError")
        },
      },
    })
    const unsubscribe = chat.subscribe((state) => {
      if (state.messages.at(-1)?.metadata?.persistedMessageId) notifyPersisted()
    })
    const sending = chat.sendMessage({ text: "question" })
    await persisted
    chat.stop()
    await sending
    unsubscribe()
    expect(chat.getState().status).toBe("ready")
    expect(canShowAssistantTurnActions(chat.getState().messages[1])).toBe(false)
    expect(
      getAssistantTurnContent(chat.getState().messages[1].parts).finalText,
    ).toBe("final answer")
  })

  it("invalidates completion if the transport fails after the terminal event", async () => {
    const chat = new PlaiChat({
      transport: {
        async *stream() {
          yield* events
          throw new Error("disconnected")
        },
      },
    })
    await chat.sendMessage({ text: "question" })
    expect(chat.getState().status).toBe("error")
    expect(canShowAssistantTurnActions(chat.getState().messages[1])).toBe(false)
  })

  it("waits for message_stop, copies final text, and matches normalized history", () => {
    let state = createInitialInternalState()
    for (const event of events.slice(0, -1)) {
      state = reduceChatState(state, event)
      expect(canShowAssistantTurnActions(state.messages[0])).toBe(false)
    }
    state = reduceChatState(state, { type: "message_stop" })
    expect(canShowAssistantTurnActions(state.messages[0])).toBe(true)
    const live = getAssistantTurnContent(state.messages[0].parts)
    expect(live.finalText).toBe("final answer")
    expect(live.leadingParts[0]).toEqual({ type: "text", text: "draft" })

    const history = normalizePlaiThreadMessages([
      {
        id: "first",
        role: "assistant",
        content_parts: [
          { type: "text", text: "draft" },
          { type: "tool_use", id: "call", name: "search", input: {} },
          {
            type: "tool_result",
            tool_use_id: "call",
            content: "found",
            tool_type: "datasource",
            is_error: false,
          },
        ],
      },
      { id: "saved", role: "assistant", content: "final answer" },
    ])
    expect(history).toHaveLength(1)
    expect(history[0].metadata?.persistedMessageId).toBe("saved")
    expect(history[0].parts[1]).toMatchObject({
      type: "tool-call",
      id: "call",
      result: "found",
    })
    expect(getAssistantTurnContent(history[0].parts).finalText).toBe(
      live.finalText,
    )
    expect(canShowAssistantTurnActions(history[0])).toBe(true)
  })

  it("joins a legacy result by call id without replacing the assistant identity", () => {
    const messages = normalizePlaiThreadMessages([
      {
        id: "a",
        role: "assistant",
        content_parts: [
          { type: "tool_use", id: "call", name: "search", input: { q: "x" } },
        ],
      },
      {
        id: "tool-row",
        role: "tool",
        tool_call_id: "call",
        tool_result: { type: "datasource", output: "found" },
      },
      { id: "last", role: "assistant", content: "answer" },
      { id: "u2", role: "user", content: "next question" },
      { id: "a2", role: "assistant", content: "next answer" },
    ])
    expect(messages).toHaveLength(3)
    expect(messages[0].metadata?.persistedMessageId).toBe("last")
    expect(messages[0].parts).toHaveLength(2)
    expect(messages[0].parts[0]).toMatchObject({
      id: "call",
      input: { q: "x" },
      result: "found",
    })
    const onlyToolAtEnd = normalizePlaiThreadMessages([
      {
        id: "a",
        role: "assistant",
        content_parts: [{ type: "tool_use", id: "call", name: "search" }],
      },
      {
        id: "tool-row",
        role: "tool",
        tool_call_id: "call",
        tool_result: { output: "found" },
      },
    ])
    expect(onlyToolAtEnd[0].metadata?.persistedMessageId).toBe("a")
    expect(canShowAssistantTurnActions(onlyToolAtEnd[0])).toBe(false)
  })

  it("does not turn an empty final block or guardrail into a copy of the draft", () => {
    let state = createInitialInternalState()
    for (const event of events.slice(0, 8))
      state = reduceChatState(state, event)
    expect(
      getAssistantTurnContent(state.messages[0].parts).hasFinalResponse,
    ).toBe(false)
    state = reduceChatState(state, {
      type: "content_block_start",
      index: 3,
      content_block: { type: "guardrail", content: "Masked output" },
    })
    state = reduceChatState(state, { type: "message_id", message_id: "saved" })
    state = reduceChatState(state, { type: "message_stop" })
    expect(getAssistantTurnContent(state.messages[0].parts)).toMatchObject({
      finalText: "",
      hasFinalResponse: true,
    })
    expect(canShowAssistantTurnActions(state.messages[0])).toBe(false)
  })

  it("retains partial output without actions after an error, even with a persisted id", () => {
    let state = createInitialInternalState()
    for (const event of events.slice(0, -1))
      state = reduceChatState(state, event)
    state = reduceChatState(state, {
      type: "error",
      error: { type: "llm_error", message: "failed" },
    })
    state = reduceChatState(state, { type: "message_stop" })
    expect(state.status).toBe("error")
    expect(getAssistantTurnContent(state.messages[0].parts).finalText).toBe(
      "final answer",
    )
    expect(canShowAssistantTurnActions(state.messages[0])).toBe(false)
  })
})
