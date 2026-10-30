import { describe, expect, it, vi } from "vitest"

import { PlaiChat } from "../chat"
import { ChatRegistry } from "../registry"
import { StreamCoordinator } from "../coordinator"
import {
  ToolConfirmationStore,
  isHiddenMessage,
  pendingActionIds,
} from "../tool-confirmations"
import { PlaiThreadTransport } from "../transport"
import type {
  ChatTransport,
  ChatTransportRequest,
  PlaiSseEvent,
  ToolConfirmationsResponse,
  UIMessage,
} from "../types"
import { streamFromString } from "./test-utils"

const PENDING = {
  action_id: "a-1",
  tool_name: "gmail_send",
  kind: "mail",
  operation: "send",
  editable: [],
  action: { to: ["ana@acme.com"], subject: "Hola" },
  expires_at: "2026-10-30T10:30:00Z",
  state_version: 1,
}

function decisionEvents(status = "executed"): PlaiSseEvent[] {
  return [
    {
      type: "message_start",
      message: { id: "msg_1", role: "assistant", model: "m" },
    },
    {
      type: "content_block_start",
      index: 0,
      content_block: {
        type: "tool_use",
        id: "call_1",
        name: "confirm_pending_actions",
        tool_type: "tool_confirmation",
        input: { action_ids: ["a-1"], decision: "confirm" },
      },
    },
    { type: "content_block_stop", index: 0 },
    {
      type: "tool_result",
      tool_use_id: "call_1",
      tool_type: "tool_confirmation",
      content: "{}",
      is_error: false,
      error_details: null,
      metadata: {
        type: "tool_confirmation",
        actions: [
          {
            action_id: "a-1",
            tool_name: "gmail_send",
            status,
            state_version: 3,
            decision_applied: true,
            error: null,
            metadata: { action: "send", result: { id: "m-1" } },
          },
        ],
      },
    },
    { type: "message_stop" },
  ] as PlaiSseEvent[]
}

function recordingTransport(events: PlaiSseEvent[]) {
  const requests: ChatTransportRequest[] = []
  const transport: ChatTransport = {
    async *stream(request) {
      requests.push(request)
      for (const event of events) yield event
    },
  }
  return { transport, requests }
}

function serverResponse(
  items: Partial<ToolConfirmationsResponse["items"][number]>[],
  serverTime = "2026-10-30T10:00:00Z",
): ToolConfirmationsResponse {
  return {
    server_time: serverTime,
    items: items.map((item) => ({
      action_id: "a-1",
      tool_name: "gmail_send",
      status: "pending",
      state_version: 1,
      expires_at: "2026-10-30T10:30:00Z",
      can_confirm: true,
      can_reject: true,
      ...item,
    })),
  }
}

describe("ToolConfirmationStore", () => {
  it("registers a held action from the stream as decidable", () => {
    const store = new ToolConfirmationStore()
    store.applyToolResult({
      type: "personal_connector",
      pending_confirmation: PENDING,
    })

    const state = store.get("a-1", Date.parse("2026-10-30T10:00:00Z"))
    expect(state).toMatchObject({
      status: "pending",
      stateVersion: 1,
      canConfirm: true,
      expiresAt: "2026-10-30T10:30:00Z",
      source: "stream",
    })
  })

  it("never lets an older answer undo a newer state", () => {
    const store = new ToolConfirmationStore()
    store.applyToolResult(
      decisionEvents()[3].type === "tool_result"
        ? (decisionEvents()[3] as { metadata: unknown }).metadata
        : null,
    )
    // A slow GET answered with the state before the decision.
    store.applyServer(serverResponse([{ status: "pending", state_version: 1 }]))

    expect(store.get("a-1")?.status).toBe("executed")
    expect(store.get("a-1")?.stateVersion).toBe(3)
  })

  it("prefers the server at the same version", () => {
    const store = new ToolConfirmationStore()
    store.applyToolResult({ pending_confirmation: PENDING })
    store.applyServer(
      serverResponse([{ can_confirm: false, can_reject: false }]),
    )

    expect(store.get("a-1")?.source).toBe("server")
    expect(store.get("a-1")?.canConfirm).toBe(false)
  })

  it("projects expiry with the server clock, not the local one", () => {
    const store = new ToolConfirmationStore()
    const localNow = Date.parse("2026-10-30T09:00:00Z")
    // The local clock is one hour behind the server.
    store.applyServer(serverResponse([{}], "2026-10-30T10:00:00Z"), localNow)

    expect(store.get("a-1", localNow)?.status).toBe("pending")
    expect(store.get("a-1", localNow + 31 * 60_000)?.status).toBe("expired")
    expect(store.get("a-1", localNow + 31 * 60_000)?.canConfirm).toBe(false)
  })

  it("keeps a not-found answer from replacing a real state", () => {
    const store = new ToolConfirmationStore()
    store.applyServer(serverResponse([{}]))
    store.applyToolResult({
      type: "tool_confirmation",
      actions: [{ action_id: "a-1", tool_name: null, status: "not_found" }],
    })

    expect(store.get("a-1")?.status).toBe("pending")
  })

  it("notifies listeners only on changes", () => {
    const store = new ToolConfirmationStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.applyServer(serverResponse([{}]))
    store.applyServer(serverResponse([{}]))

    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe("PlaiChat tool decisions", () => {
  it("sends decisions without a visible user bubble and updates the store", async () => {
    const { transport, requests } = recordingTransport(decisionEvents())
    const chat = new PlaiChat({ transport, generateId: () => "user_1" })

    await chat.decideToolActions([{ action_id: "a-1", decision: "confirm" }])

    const [request] = requests
    expect(request.message.text).toBe("")
    expect(request.message.toolDecisions).toEqual([
      { action_id: "a-1", decision: "confirm" },
    ])
    expect(request.message.decisionRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    const [user] = chat.getState().messages
    expect(user.parts).toEqual([])
    expect(isHiddenMessage(user)).toBe(true)
    expect(chat.toolConfirmations.get("a-1")?.status).toBe("executed")
  })

  it("keeps the message visible when text goes with the decisions", async () => {
    const { transport, requests } = recordingTransport(decisionEvents())
    const chat = new PlaiChat({ transport })

    await chat.decideToolActions([{ action_id: "a-1", decision: "reject" }], {
      text: "y dile que llamo mañana",
    })

    expect(requests[0].message.text).toBe("y dile que llamo mañana")
    const [user] = chat.getState().messages
    expect(isHiddenMessage(user)).toBe(false)
    expect(user.metadata?.metadata?.tool_decisions).toEqual([
      { action_id: "a-1", decision: "reject" },
    ])
  })

  it("uses a new request id per submission", async () => {
    const { transport, requests } = recordingTransport(decisionEvents())
    const chat = new PlaiChat({ transport })

    await chat.decideToolActions([{ action_id: "a-1", decision: "confirm" }])
    await chat.decideToolActions([{ action_id: "a-1", decision: "confirm" }])

    expect(requests[0].message.decisionRequestId).not.toBe(
      requests[1].message.decisionRequestId,
    )
  })

  it("refreshes only the held actions whose state may still change", async () => {
    const getToolConfirmations = vi.fn(async () => serverResponse([{}]))
    const history: UIMessage[] = [
      {
        id: "m1",
        role: "assistant",
        parts: [
          {
            type: "tool-call",
            id: "t1",
            name: "gmail_send",
            toolType: "personal_connector",
            state: "completed",
            input: {},
            metadata: { pending_confirmation: PENDING },
          },
          {
            type: "tool-call",
            id: "t2",
            name: "gmail_send",
            toolType: "personal_connector",
            state: "completed",
            input: {},
            metadata: {
              pending_confirmation: { ...PENDING, action_id: "a-2" },
            },
          },
        ],
      } as UIMessage,
    ]
    const chat = new PlaiChat({
      transport: { stream: async function* () {}, getToolConfirmations },
      initialMessages: history,
    })
    chat.toolConfirmations.applyServer(
      serverResponse([
        { action_id: "a-2", status: "executed", state_version: 3 },
      ]),
    )

    await chat.refreshToolConfirmations()

    expect(pendingActionIds(history)).toEqual(["a-1", "a-2"])
    expect(getToolConfirmations).toHaveBeenCalledWith(
      expect.objectContaining({ actionIds: ["a-1"] }),
    )
    expect(chat.toolConfirmations.get("a-1")?.source).toBe("server")
  })

  it("skips the hidden decision message when resending", async () => {
    const { transport, requests } = recordingTransport([
      {
        type: "message_start",
        message: { id: "msg_2", role: "assistant", model: "m" },
      },
      { type: "message_stop" },
    ] as PlaiSseEvent[])
    const chat = new PlaiChat({
      transport,
      initialMessages: [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "manda el correo" }],
        },
        { id: "a1", role: "assistant", parts: [] },
        {
          id: "u2",
          role: "user",
          parts: [
            {
              type: "text",
              text: "[Decisions from the action cards] a-1: confirm",
            },
          ],
          metadata: { metadata: { hidden: true } },
        },
        { id: "a2", role: "assistant", parts: [] },
      ],
    })

    await chat.resendMessage({ messageId: "a2" })

    expect(requests[0].message.text).toBe("manda el correo")
  })

  it("runs decisions through the registry", async () => {
    const { transport, requests } = recordingTransport(decisionEvents())
    const registry = new ChatRegistry({
      create: () => new PlaiChat({ transport }),
      coordinator: new StreamCoordinator({ maxActiveStreams: 2 }),
    })

    await registry.runInvocation("thread-1", (invocation) =>
      invocation.decideToolActions([{ action_id: "a-1", decision: "confirm" }]),
    )

    expect(requests[0].message.toolDecisions).toHaveLength(1)
    expect(registry.get("thread-1")?.toolConfirmations.get("a-1")?.status).toBe(
      "executed",
    )
  })
})

describe("PlaiThreadTransport tool confirmations", () => {
  it("sends tool_decisions and decision_request_id in the invoke body", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          streamFromString(
            'event: message_stop\ndata: {"type":"message_stop"}\n\n',
            8,
          ),
          {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          },
        ),
    )
    const transport = new PlaiThreadTransport({
      api: "https://api.test",
      chatSessionId: "cs-1",
      threadId: "t-1",
      fetch: fetchMock,
    })

    for await (const _event of transport.stream({
      messages: [],
      message: {
        text: "",
        toolDecisions: [{ action_id: "a-1", decision: "confirm" }],
        decisionRequestId: "dr-1",
      },
      signal: new AbortController().signal,
    })) {
      // drain
    }

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({
      prompt: "",
      tool_decisions: [{ action_id: "a-1", decision: "confirm" }],
      decision_request_id: "dr-1",
    })
  })

  it("reads the thread's tool confirmations", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(serverResponse([{}])), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    )
    const transport = new PlaiThreadTransport({
      api: "https://api.test/",
      chatSessionId: "cs 1",
      threadId: "t-1",
      fetch: fetchMock,
    })

    const response = await transport.getToolConfirmations({
      actionIds: ["a-1", "a-2"],
    })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe(
      "https://api.test/chat_sessions/cs%201/threads/t-1/tool_confirmations?action_ids=a-1&action_ids=a-2",
    )
    expect(init.method).toBe("GET")
    expect(response.items[0].action_id).toBe("a-1")
  })

  it("rejects a malformed tool confirmations answer", async () => {
    const transport = new PlaiThreadTransport({
      api: "https://api.test",
      chatSessionId: "cs-1",
      threadId: "t-1",
      fetch: vi.fn(
        async () =>
          new Response(JSON.stringify({ items: [] }), { status: 200 }),
      ),
    })

    await expect(transport.getToolConfirmations()).rejects.toThrow(
      "server_time",
    )
  })
})
