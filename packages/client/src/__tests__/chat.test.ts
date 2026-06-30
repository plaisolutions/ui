import { beforeEach, describe, expect, it, vi } from "vitest"

import { PlaiChat } from "../chat"
import type { ChatTransport, PlaiSseEvent } from "../types"

function createTransport(events: PlaiSseEvent[], delayMs = 0): ChatTransport {
  return {
    async *stream({ signal }) {
      for (const event of events) {
        if (signal.aborted) {
          throw new DOMException("Aborted", "AbortError")
        }
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
        yield event
      }
    },
  }
}

describe("PlaiChat", () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it("appends user message and streams assistant response incrementally", async () => {
    const events: PlaiSseEvent[] = [
      {
        type: "message_start",
        message: { id: "msg_a", role: "assistant", model: "gpt-5.4-mini" },
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
        type: "message_stop",
      },
    ]

    const chat = new PlaiChat({
      transport: createTransport(events),
      generateId: () => "user_1",
    })

    await chat.sendMessage({ text: "Hi" })

    const state = chat.getState()
    expect(state.messages[0].id).toBe("user_1")
    expect(state.messages[1].parts[0]).toEqual({ type: "text", text: "Hello" })
    expect(state.status).toBe("ready")
  })

  it("notifies subscribers on each state change", async () => {
    const chat = new PlaiChat({
      transport: createTransport([
        {
          type: "message_start",
          message: { id: "msg_a", role: "assistant", model: "gpt-5.4-mini" },
        },
        {
          type: "message_stop",
        },
      ]),
    })

    const listener = vi.fn()
    const unsubscribe = chat.subscribe(listener)

    await chat.sendMessage({ text: "Hi" })
    unsubscribe()

    expect(listener).toHaveBeenCalled()
    expect(listener.mock.calls.at(-1)?.[0].status).toBe("ready")
  })

  it("stop aborts an in-flight request and keeps partial content", async () => {
    const chat = new PlaiChat({
      transport: createTransport(
        [
          {
            type: "message_start",
            message: { id: "msg_a", role: "assistant", model: "gpt-5.4-mini" },
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
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: " still running" },
          },
          {
            type: "message_stop",
          },
        ],
        20,
      ),
    })

    const sendPromise = chat.sendMessage({ text: "Hi" })
    await new Promise((resolve) => setTimeout(resolve, 45))
    chat.stop()
    await sendPromise

    const state = chat.getState()
    expect(state.status).toBe("ready")
    expect(state.messages[1].parts[0]).toEqual({
      type: "text",
      text: "partial",
    })
  })

  it("normalizes thrown errors and exposes them in state", async () => {
    const chat = new PlaiChat({
      transport: {
        async *stream() {
          yield* []
          throw new TypeError("Failed to fetch")
        },
      },
    })

    await chat.sendMessage({ text: "Hi" })

    const state = chat.getState()
    expect(state.status).toBe("error")
    expect(state.error?.type).toBe("network_error")
  })

  it("resets state to initial values", async () => {
    const chat = new PlaiChat({
      transport: createTransport([]),
      initialMessages: [
        {
          id: "initial_user",
          role: "user",
          parts: [{ type: "text", text: "hello" }],
        },
      ],
    })

    await chat.sendMessage({ text: "New" })
    chat.reset()

    const state = chat.getState()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].id).toBe("initial_user")
    expect(state.status).toBe("ready")
  })

  it("throws when sendMessage is called while streaming", async () => {
    const chat = new PlaiChat({
      transport: createTransport(
        [
          {
            type: "message_start",
            message: { id: "msg_a", role: "assistant", model: "gpt-5.4-mini" },
          },
          {
            type: "message_stop",
          },
        ],
        30,
      ),
    })

    const sending = chat.sendMessage({ text: "First" })

    await expect(chat.sendMessage({ text: "Second" })).rejects.toThrow(
      /Cannot send a message/,
    )

    await sending
  })
})
