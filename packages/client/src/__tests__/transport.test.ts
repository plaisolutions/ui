import { describe, expect, it, vi } from "vitest"

import { HttpStatusError } from "../errors"
import { PlaiThreadTransport } from "../transport"
import { streamFromString } from "./test-utils"

function makeStreamResponse(body: string, status = 200): Response {
  return new Response(streamFromString(body, 6), {
    status,
    headers: {
      "Content-Type": "text/event-stream",
    },
  })
}

describe("PlaiThreadTransport", () => {
  it("streams events from invoke endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        makeStreamResponse(
          'event: message_stop\ndata: {"type":"message_stop"}\n\n',
        ),
      )

    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com",
      chatSessionId: "session_1",
      threadId: "thread_1",
      fetch: fetchMock,
    })

    const events: unknown[] = []
    for await (const event of transport.stream({
      messages: [],
      message: { text: "Hello" },
      signal: new AbortController().signal,
    })) {
      events.push(event)
    }

    expect(events).toEqual([{ type: "message_stop" }])
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.plaisolutions.com/chat_sessions/session_1/threads/thread_1/invoke",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("maps request body to backend payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        makeStreamResponse(
          'event: message_stop\ndata: {"type":"message_stop"}\n\n',
        ),
      )

    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com/chat_sessions/x/threads/y/invoke",
      fetch: fetchMock,
    })

    for await (const _event of transport.stream({
      messages: [],
      message: {
        text: "Hola",
        enabledTools: ["a", "b"],
        documents: [
          { url: "https://example.com/doc.pdf", filename: "doc.pdf" },
        ],
      },
      signal: new AbortController().signal,
    })) {
      // consume
    }

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(
      JSON.stringify({
        prompt: "Hola",
        enabled_tools: ["a", "b"],
        documents: [
          { url: "https://example.com/doc.pdf", filename: "doc.pdf" },
        ],
      }),
    )
  })

  it("throws HttpStatusError on non-2xx responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("conflict", { status: 409, statusText: "Conflict" }),
      )

    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com/chat_sessions/x/threads/y/invoke",
      fetch: fetchMock,
    })

    await expect(async () => {
      for await (const _event of transport.stream({
        messages: [],
        message: { text: "Hi" },
        signal: new AbortController().signal,
      })) {
        // no-op
      }
    }).rejects.toBeInstanceOf(HttpStatusError)
  })

  it("supports dynamic headers function", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        makeStreamResponse(
          'event: message_stop\ndata: {"type":"message_stop"}\n\n',
        ),
      )

    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com/chat_sessions/x/threads/y/invoke",
      headers: async () => ({ Authorization: "Bearer token" }),
      fetch: fetchMock,
    })

    for await (const _event of transport.stream({
      messages: [],
      message: { text: "Hi" },
      signal: new AbortController().signal,
    })) {
      // consume
    }

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }]
    expect(init.headers.get("Authorization")).toBe("Bearer token")
  })
})
