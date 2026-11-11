import { describe, expect, it, vi } from "vitest"

import { PlaiChat } from "../chat"
import {
  HttpStatusError,
  ToolDecisionRejectedError,
  ToolSubmissionConflictError,
} from "../errors"
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

  it("marks the replaced version superseded and links both ways", () => {
    const store = new ToolConfirmationStore()
    store.applyToolResult({
      type: "personal_connector",
      pending_confirmation: PENDING,
    })

    store.applyToolResult({
      type: "personal_connector",
      pending_confirmation: {
        ...PENDING,
        action_id: "a-2",
        supersedes_action_id: "a-1",
      },
      superseded: {
        action_id: "a-1",
        status: "superseded",
        state_version: 2,
        superseded_by_action_id: "a-2",
      },
    })

    const now = Date.parse("2026-10-30T10:00:00Z")
    expect(store.get("a-1", now)).toMatchObject({
      status: "superseded",
      stateVersion: 2,
      canConfirm: false,
      canReject: false,
      supersededBy: "a-2",
      // The card of the old version still shows what it said.
      pendingConfirmation: { action_id: "a-1" },
    })
    expect(store.get("a-2", now)).toMatchObject({
      status: "pending",
      canConfirm: true,
      supersedes: "a-1",
    })
  })

  it("keeps what ran after an edit, from the stream and from the server", () => {
    const store = new ToolConfirmationStore()
    store.applyToolResult({
      type: "personal_connector",
      pending_confirmation: PENDING,
    })
    store.applyToolResult({
      type: "tool_confirmation",
      actions: [
        {
          action_id: "a-1",
          tool_name: "gmail_send",
          status: "executed",
          state_version: 3,
          effective_action: { subject: "Revisado" },
        },
      ],
    })
    expect(store.get("a-1")?.effectiveAction).toEqual({ subject: "Revisado" })

    // A server answer at the same version brings the same effective view.
    store.applyServer(
      serverResponse([
        {
          status: "executed",
          state_version: 3,
          effective_action: { subject: "Revisado" },
          supersedes_action_id: "a-0",
        },
      ]),
    )
    expect(store.get("a-1")).toMatchObject({
      source: "server",
      effectiveAction: { subject: "Revisado" },
      supersedes: "a-0",
    })
  })

  it("an edit that no longer holds leaves the action pending", () => {
    const store = new ToolConfirmationStore()
    store.applyToolResult({
      type: "personal_connector",
      pending_confirmation: PENDING,
    })
    store.applyToolResult({
      type: "tool_confirmation",
      actions: [
        {
          action_id: "a-1",
          tool_name: "gmail_send",
          status: "pending",
          state_version: 1,
          decision_applied: false,
          error: "invalid_edit",
        },
      ],
    })

    expect(store.get("a-1", Date.parse("2026-10-30T10:00:00Z"))).toMatchObject({
      status: "pending",
      canConfirm: true,
      error: "invalid_edit",
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

describe("PlaiChat rejected edits", () => {
  const rejection = () =>
    new HttpStatusError(
      422,
      "Unprocessable Entity",
      JSON.stringify({
        detail: {
          code: "invalid_tool_decision",
          detail: "invalid edit of action a-1",
          action_id: "a-1",
          errors: [{ field: "to", message: "needs at least one recipient" }],
        },
      }),
    )

  it("undoes the local message and rejects with the field errors", async () => {
    const onError = vi.fn()
    const chat = new PlaiChat({
      transport: {
        // biome-ignore lint/correctness/useYield: the request fails before any event
        async *stream() {
          throw rejection()
        },
      },
      onError,
    })

    const attempt = chat.decideToolActions([
      { action_id: "a-1", decision: "confirm", arguments: { to: [] } },
    ])

    await expect(attempt).rejects.toBeInstanceOf(ToolDecisionRejectedError)
    await expect(attempt).rejects.toMatchObject({
      details: {
        actionId: "a-1",
        errors: [{ field: "to", message: "needs at least one recipient" }],
      },
    })
    // The conversation is untouched and not in an error state: nothing was sent.
    expect(chat.getState().messages).toEqual([])
    expect(chat.getState().status).toBe("ready")
    expect(chat.getState().error).toBeNull()
    expect(onError).not.toHaveBeenCalled()
  })

  it("lets the next submission go through after a rejection", async () => {
    let calls = 0
    const chat = new PlaiChat({
      transport: {
        async *stream() {
          calls += 1
          if (calls === 1) throw rejection()
          yield { type: "message_stop" } as PlaiSseEvent
        },
      },
    })

    await expect(
      chat.decideToolActions([
        { action_id: "a-1", decision: "confirm", arguments: { to: [] } },
      ]),
    ).rejects.toBeInstanceOf(ToolDecisionRejectedError)
    await chat.decideToolActions([
      { action_id: "a-1", decision: "confirm", arguments: { to: ["a@b.co"] } },
    ])

    expect(calls).toBe(2)
    expect(chat.getState().status).toBe("ready")
  })

  it("keeps other HTTP failures as chat errors", async () => {
    const onError = vi.fn()
    const chat = new PlaiChat({
      transport: {
        // biome-ignore lint/correctness/useYield: the request fails before any event
        async *stream() {
          throw new HttpStatusError(
            409,
            "Conflict",
            '{"detail":{"code":"thread_busy"}}',
          )
        },
      },
      onError,
    })

    await chat.decideToolActions([{ action_id: "a-1", decision: "confirm" }])

    expect(chat.getState().status).toBe("error")
    expect(chat.getState().error).toMatchObject({
      status: 409,
      code: "thread_busy",
    })
    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe("PlaiChat retries of a decision submission", () => {
  const conflict = (code: string, executionId: string | null = null) =>
    new HttpStatusError(
      409,
      "Conflict",
      JSON.stringify({
        detail: {
          code,
          detail: "already registered",
          execution_id: executionId,
        },
      }),
    )

  /** A chat whose transport answers each request with the next scripted outcome. */
  function scripted(outcomes: ("ok" | Error)[]) {
    const ids: (string | undefined)[] = []
    const chat = new PlaiChat({
      transport: {
        async *stream(request) {
          ids.push(request.message.decisionRequestId)
          const next = outcomes.shift() ?? "ok"
          if (next !== "ok") throw next
          yield { type: "message_stop" } as PlaiSseEvent
        },
      },
    })
    return { chat, ids }
  }

  const confirm = (patch?: Record<string, unknown>) => [
    {
      action_id: "a-1",
      decision: "confirm" as const,
      ...(patch ? { arguments: patch } : {}),
    },
  ]

  it("undoes the message and rejects with the conflict when it is already being applied", async () => {
    const onError = vi.fn()
    const chat = new PlaiChat({
      transport: {
        // biome-ignore lint/correctness/useYield: the request fails before any event
        async *stream() {
          throw conflict("decision_in_progress", "run-1")
        },
      },
      onError,
    })

    const attempt = chat.decideToolActions(confirm())

    await expect(attempt).rejects.toBeInstanceOf(ToolSubmissionConflictError)
    await expect(attempt).rejects.toMatchObject({
      details: { code: "decision_in_progress", executionId: "run-1" },
    })
    expect(chat.getState().messages).toEqual([])
    expect(chat.getState().status).toBe("ready")
    expect(chat.getState().error).toBeNull()
    expect(onError).not.toHaveBeenCalled()
  })

  it("settles a conflict through the registry as completed, without a send", async () => {
    const registry = new ChatRegistry({
      coordinator: new StreamCoordinator(),
      create: (_key, hooks) =>
        new PlaiChat({
          transport: {
            // biome-ignore lint/correctness/useYield: the request fails before any event
            async *stream() {
              throw conflict("decision_request_conflict")
            },
          },
          ...hooks,
        }),
    })
    const settled = vi.fn()
    registry.onSettled((_, result) => settled(result))

    await expect(
      registry.runInvocation("a", (op) => op.decideToolActions(confirm())),
    ).rejects.toBeInstanceOf(ToolSubmissionConflictError)

    expect(settled).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "completed",
        error: null,
        didSend: false,
      }),
    )
  })

  it("retries the same decisions under the same key after a failure", async () => {
    const { chat, ids } = scripted([new TypeError("network down"), "ok"])

    await chat.decideToolActions(confirm())
    expect(chat.getState().status).toBe("error")
    chat.clearError() // the host clears the failure before the user tries again
    await chat.decideToolActions(confirm())

    expect(ids).toHaveLength(2)
    expect(ids[0]).toBeTruthy()
    expect(ids[1]).toBe(ids[0])
  })

  it("uses a new key when anything about the submission changed", async () => {
    const { chat, ids } = scripted([
      new TypeError("down"),
      new TypeError("down"),
      "ok",
    ])

    await chat.decideToolActions(confirm())
    chat.clearError()
    await chat.decideToolActions(confirm({ subject: "Otro" })) // an edit
    chat.clearError()
    await chat.decideToolActions(confirm({ subject: "Otro" }), {
      text: "y mándalo",
    })

    expect(new Set(ids).size).toBe(3)
  })

  it("does not reuse the key of a submission that went through", async () => {
    const { chat, ids } = scripted(["ok", "ok"])

    await chat.decideToolActions(confirm())
    await chat.decideToolActions(confirm())

    expect(ids[1]).not.toBe(ids[0])
  })

  it("keeps the key while the first submission is still being applied", async () => {
    const { chat, ids } = scripted([
      conflict("decision_in_progress", "run-1"),
      "ok",
    ])

    await expect(chat.decideToolActions(confirm())).rejects.toBeInstanceOf(
      ToolSubmissionConflictError,
    )
    await chat.decideToolActions(confirm())

    expect(ids[1]).toBe(ids[0])
  })

  it("starts over after a rejected edit: nothing was registered", async () => {
    const rejected = new HttpStatusError(
      422,
      "Unprocessable Entity",
      JSON.stringify({
        detail: { code: "invalid_tool_decision", action_id: "a-1", errors: [] },
      }),
    )
    const { chat, ids } = scripted([rejected, "ok"])

    await expect(chat.decideToolActions(confirm())).rejects.toBeInstanceOf(
      ToolDecisionRejectedError,
    )
    await chat.decideToolActions(confirm())

    expect(ids[1]).not.toBe(ids[0])
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

  it("sends the edit patch only with confirm and never copies it elsewhere", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          streamFromString(
            'event: message_stop\ndata: {"type":"message_stop"}\n\n',
            8,
          ),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
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
        toolDecisions: [
          {
            action_id: "a-1",
            decision: "confirm",
            arguments: { subject: "Revisado", cc: null },
          },
          { action_id: "a-2", decision: "confirm" },
          // A reject with arguments is a client bug: it must not reach the API.
          { action_id: "a-3", decision: "reject", arguments: { subject: "x" } },
        ],
        decisionRequestId: "dr-1",
      },
      signal: new AbortController().signal,
    })) {
      // drain
    }

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string).tool_decisions).toEqual([
      {
        action_id: "a-1",
        decision: "confirm",
        arguments: { subject: "Revisado", cc: null },
      },
      { action_id: "a-2", decision: "confirm" },
      { action_id: "a-3", decision: "reject" },
    ])
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
