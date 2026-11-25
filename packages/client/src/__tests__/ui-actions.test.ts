import { describe, expect, it, vi } from "vitest"

import { PlaiChat } from "../chat"
import { normalizePlaiThreadMessages } from "../history"
import { parseSseStream } from "../sse"
import { UiActionDispatcher, parseUiActionEffect } from "../ui-actions"
import type {
  ChatTransport,
  PlaiSseEvent,
  UiActionEffect,
  UiActionIssue,
} from "../types"
import { streamFromString } from "./test-utils"

const effect = (overrides: Partial<UiActionEffect> = {}): UiActionEffect => ({
  action_id: "uia_1",
  action: "set_title",
  payload: { title: "Onboarding" },
  replayable: true,
  ...overrides,
})

const uiActionEvent = (e: UiActionEffect = effect()): PlaiSseEvent => ({
  type: "ui_action",
  tool_use_id: "tool_1",
  ui_action: e,
})

function transport(events: PlaiSseEvent[]): ChatTransport {
  return {
    async *stream() {
      for (const event of events) yield event
    },
  }
}

const turn = (...middle: PlaiSseEvent[]): PlaiSseEvent[] => [
  {
    type: "message_start",
    message: { id: "msg_a", role: "assistant", model: "m" },
  },
  ...middle,
  { type: "message_stop" },
]

describe("ui_action parsing", () => {
  it("accepts the ui_action SSE event", async () => {
    const frame = `event: ui_action\ndata: ${JSON.stringify(uiActionEvent())}\n\n`
    const events: PlaiSseEvent[] = []
    for await (const event of parseSseStream(streamFromString(frame))) {
      events.push(event)
    }
    expect(events).toEqual([uiActionEvent()])
  })

  it("normalizes a wire effect and rejects a malformed one", () => {
    expect(parseUiActionEffect({ action_id: "a", action: "x" })).toEqual({
      action_id: "a",
      action: "x",
      payload: {},
      replayable: true,
    })
    expect(parseUiActionEffect({ action: "x" })).toBeUndefined()
    expect(parseUiActionEffect("nope")).toBeUndefined()
    expect(
      parseUiActionEffect({ action_id: "a", action: "x", replayable: false })
        ?.replayable,
    ).toBe(false)
  })
})

describe("UiActionDispatcher", () => {
  it("runs the handler registered for the action with payload and context", () => {
    const handler = vi.fn()
    const dispatcher = new UiActionDispatcher({
      handlers: { set_title: handler },
    })
    expect(
      dispatcher.dispatch(effect(), { toolUseId: "t", replay: false }),
    ).toBe(true)
    expect(handler).toHaveBeenCalledWith(
      { title: "Onboarding" },
      { actionId: "uia_1", toolUseId: "t", replay: false },
    )
  })

  it("reads handlers from a function on every effect", () => {
    const first = vi.fn()
    const second = vi.fn()
    let current: Record<string, typeof first> = { set_title: first }
    const dispatcher = new UiActionDispatcher({ handlers: () => current })
    dispatcher.dispatch(effect({ action_id: "1" }), {
      toolUseId: "t",
      replay: false,
    })
    current = { set_title: second }
    dispatcher.dispatch(effect({ action_id: "2" }), {
      toolUseId: "t",
      replay: false,
    })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it("deduplicates by action_id", () => {
    const handler = vi.fn()
    const dispatcher = new UiActionDispatcher({
      handlers: { set_title: handler },
    })
    dispatcher.dispatch(effect(), { toolUseId: "t", replay: false })
    expect(
      dispatcher.dispatch(effect(), { toolUseId: "t", replay: true }),
    ).toBe(false)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("reports an unmapped action without throwing, and still runs it once a handler exists", () => {
    const issues: UiActionIssue[] = []
    const dispatcher = new UiActionDispatcher({
      onIssue: (i) => issues.push(i),
    })
    expect(
      dispatcher.dispatch(effect(), { toolUseId: "t", replay: false }),
    ).toBe(false)
    expect(issues).toEqual([
      {
        type: "ui_action.unmapped",
        action: "set_title",
        actionId: "uia_1",
        toolUseId: "t",
      },
    ])
    const handler = vi.fn()
    dispatcher.setHandlers({ set_title: handler })
    dispatcher.dispatch(effect(), { toolUseId: "t", replay: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("captures a sync throw and an async rejection as ui_action.failed", async () => {
    const issues: UiActionIssue[] = []
    const dispatcher = new UiActionDispatcher({
      handlers: {
        boom: () => {
          throw new Error("sync")
        },
        later: async () => {
          throw new Error("async")
        },
      },
      onIssue: (i) => issues.push(i),
    })
    dispatcher.dispatch(effect({ action_id: "1", action: "boom" }), {
      toolUseId: "t",
      replay: false,
    })
    dispatcher.dispatch(effect({ action_id: "2", action: "later" }), {
      toolUseId: "t",
      replay: false,
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(issues.map((i) => [i.type, i.actionId])).toEqual([
      ["ui_action.failed", "1"],
      ["ui_action.failed", "2"],
    ])
  })
})

describe("PlaiChat ui_action", () => {
  it("runs the handler from the stream even when no tool_result arrives", async () => {
    const handler = vi.fn()
    const chat = new PlaiChat({
      transport: transport(turn(uiActionEvent())),
      uiActionHandlers: { set_title: handler },
    })
    await chat.sendMessage({ text: "hi" })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]?.[1]).toMatchObject({
      toolUseId: "tool_1",
      replay: false,
    })
    expect(chat.getState().status).toBe("ready")
  })

  it("does not break the stream when the handler throws", async () => {
    const chat = new PlaiChat({
      transport: transport(turn(uiActionEvent())),
      uiActionHandlers: {
        set_title: () => {
          throw new Error("nope")
        },
      },
    })
    await chat.sendMessage({ text: "hi" })
    expect(chat.getState().status).toBe("ready")
  })
})

describe("ui_action replay", () => {
  const history = () =>
    normalizePlaiThreadMessages([
      { id: "u1", role: "user", content: "hi" },
      {
        id: "a1",
        role: "assistant",
        content_parts: [
          {
            type: "tool_use",
            id: "tool_1",
            name: "rename",
            tool_type: "http_request",
            input: {},
          },
          {
            type: "tool_result",
            tool_use_id: "tool_1",
            content: "ok",
            metadata: { ui_action: effect() },
          },
          {
            type: "tool_use",
            id: "tool_2",
            name: "finish",
            tool_type: "http_request",
            input: {},
          },
          {
            type: "tool_result",
            tool_use_id: "tool_2",
            content: "ok",
            metadata: {
              ui_action: effect({
                action_id: "uia_2",
                action: "finish_task",
                replayable: false,
              }),
            },
          },
        ],
      },
    ])

  it("re-applies replayable effects from the history, in order, flagged as replay", () => {
    const setTitle = vi.fn()
    const finish = vi.fn()
    const dispatcher = new UiActionDispatcher({
      handlers: { set_title: setTitle, finish_task: finish },
    })
    dispatcher.replay(history())
    expect(setTitle).toHaveBeenCalledWith(
      { title: "Onboarding" },
      { actionId: "uia_1", toolUseId: "tool_1", replay: true },
    )
    expect(finish).not.toHaveBeenCalled()
  })

  it("does not repeat an effect the stream already applied", () => {
    const setTitle = vi.fn()
    const dispatcher = new UiActionDispatcher({
      handlers: { set_title: setTitle },
    })
    dispatcher.dispatch(effect(), { toolUseId: "tool_1", replay: false })
    dispatcher.replay(history())
    expect(setTitle).toHaveBeenCalledTimes(1)
  })
})
