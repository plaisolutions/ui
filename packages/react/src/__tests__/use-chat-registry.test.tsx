import { act, render, renderHook, waitFor } from "@testing-library/react"
import { StrictMode, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  ChatRegistry,
  PlaiChat,
  StreamCoordinator,
  type ChatTransport,
  type PlaiSseEvent,
} from "@plaisolutions/client"
import { useChat } from "../use-chat"
import {
  useChatRegistryBusy,
  useOwnedChatRegistry,
  useRegistryChat,
  useStreamCoordinator,
} from "../use-chat-registry"

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

/** Streams a partial text block, waits for `gate`, then finishes. */
function gatedTransport(gate: Promise<void>): ChatTransport {
  const head: PlaiSseEvent[] = [
    {
      type: "message_start",
      message: { id: "msg_a", role: "assistant", model: "m" },
    },
    { type: "content_block_start", index: 0, content_block: { type: "text" } },
    {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "Hel" },
    },
  ]
  const tail: PlaiSseEvent[] = [
    {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "lo" },
    },
    { type: "content_block_stop", index: 0 },
    { type: "message_stop" },
  ]
  return {
    async *stream({ signal }) {
      for (const event of head) yield event
      await gate
      if (signal.aborted) throw new DOMException("Aborted", "AbortError")
      for (const event of tail) yield event
    },
  }
}

function assistantText(chat: PlaiChat): string {
  const message = chat.getState().messages.find((m) => m.role === "assistant")
  return (message?.parts ?? [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}

function createRegistry(transport: () => ChatTransport, maxIdle?: number) {
  return new ChatRegistry({
    coordinator: new StreamCoordinator(),
    maxIdle,
    create: (_, hooks) => new PlaiChat({ transport: transport(), ...hooks }),
  })
}

describe("useChat with an external instance", () => {
  it("does not stop the stream on unmount and shows partials on remount", async () => {
    const gate = deferred()
    const chat = new PlaiChat({ transport: gatedTransport(gate.promise) })
    const first = renderHook(() => useChat({ chat }))

    let sending!: Promise<void>
    act(() => {
      sending = chat.sendMessage({ text: "hi" })
    })
    await waitFor(() => expect(assistantText(chat)).toBe("Hel"))
    first.unmount()

    const second = renderHook(() => useChat({ chat }))
    expect(second.result.current.status).toBe("streaming")

    await act(async () => {
      gate.resolve()
      await sending
    })
    expect(second.result.current.status).toBe("ready")
    expect(assistantText(chat)).toBe("Hello")
  })

  it("follows a new instance when the registry changes for the same key", () => {
    const one = createRegistry(() => gatedTransport(Promise.resolve()))
    const two = createRegistry(() => gatedTransport(Promise.resolve()))
    const { result, rerender } = renderHook(
      ({ registry }) => useRegistryChat(registry, "t"),
      { initialProps: { registry: one } },
    )
    expect(result.current).toBe(one.get("t"))
    rerender({ registry: two })
    expect(result.current).toBe(two.get("t"))
  })
})

describe("registry hooks", () => {
  it("keeps the owned registry and the rendered instance connected under StrictMode", async () => {
    const seen: { registry: ChatRegistry; chat: PlaiChat }[] = []
    function Probe() {
      const registry = useOwnedChatRegistry(
        () => createRegistry(() => gatedTransport(Promise.resolve()), 0),
        "session",
      )
      const chat = useRegistryChat(registry, "t")
      seen.push({ registry, chat })
      return null
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    )
    const { unmount } = render(<Probe />, { wrapper })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const last = seen[seen.length - 1]
    expect(last).toBeDefined()
    if (!last) return
    expect(last.registry.isDisposed()).toBe(false)
    expect(last.registry.get("t")).toBe(last.chat)

    unmount()
    expect(last.registry.isDisposed()).toBe(true)
  })

  it("creates a new registry when the reset key changes", () => {
    const { result, rerender } = renderHook(
      ({ session }) =>
        useOwnedChatRegistry(
          () => createRegistry(() => gatedTransport(Promise.resolve())),
          session,
        ),
      { initialProps: { session: "a" } },
    )
    const first = result.current
    rerender({ session: "b" })
    expect(result.current).not.toBe(first)
    expect(first.isDisposed()).toBe(true)
  })

  it("reports busy keys and coordinator slots", async () => {
    const gate = deferred()
    const registry = createRegistry(() => gatedTransport(gate.promise))
    const { result } = renderHook(() => ({
      busy: useChatRegistryBusy(registry),
      slots: useStreamCoordinator(registry.coordinator),
    }))
    expect(result.current.busy.size).toBe(0)

    let run!: Promise<void>
    act(() => {
      run = registry.runInvocation("t", (op) => op.sendMessage({ text: "x" }))
    })
    expect(result.current.busy.has("t")).toBe(true)
    expect(result.current.slots.occupied).toBe(1)

    await act(async () => {
      gate.resolve()
      await run
    })
    expect(result.current.busy.size).toBe(0)
    expect(result.current.slots.occupied).toBe(0)
  })

  it("renders on the server without opening streams", () => {
    const registry = createRegistry(() => ({
      stream() {
        throw new Error("streams must not open during SSR")
      },
    }))
    function Server() {
      const chat = useRegistryChat(registry, "t")
      const { status } = useChat({ chat })
      const busy = useChatRegistryBusy(registry)
      return (
        <span>
          {status}:{busy.size}
        </span>
      )
    }
    expect(renderToString(<Server />)).toContain("ready")
  })
})
