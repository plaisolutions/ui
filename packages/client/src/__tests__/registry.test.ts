import { describe, expect, it, vi } from "vitest"

import { PlaiChat } from "../chat"
import { StreamCoordinator } from "../coordinator"
import {
  ChatRegistry,
  ChatRegistryError,
  type ChatInvocationSettled,
} from "../registry"
import type { ChatTransport, MediaFile, PlaiSseEvent } from "../types"

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const START: PlaiSseEvent = {
  type: "message_start",
  message: { id: "msg_a", role: "assistant", model: "m" },
}
const STOP: PlaiSseEvent = { type: "message_stop" }

/** Streams `events`, waiting for `gate` (if any) before the last one. */
function controlledTransport(
  events: PlaiSseEvent[],
  options: {
    gate?: Promise<void>
    upload?: (signal: AbortSignal) => Promise<MediaFile>
    onStream?: () => void
  } = {},
): ChatTransport {
  return {
    async *stream({ signal }) {
      options.onStream?.()
      for (const [index, event] of events.entries()) {
        if (index === events.length - 1 && options.gate) {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError")
          await Promise.race([
            options.gate,
            new Promise<void>((_, reject) =>
              signal.addEventListener("abort", () =>
                reject(new DOMException("Aborted", "AbortError")),
              ),
            ),
          ])
        }
        if (signal.aborted) throw new DOMException("Aborted", "AbortError")
        yield event
      }
    },
    uploadFile: options.upload
      ? async ({ signal }) =>
          (options.upload as (s: AbortSignal) => Promise<MediaFile>)(signal)
      : undefined,
  }
}

function mediaFile(id: string): MediaFile {
  return {
    id,
    name: `${id}.pdf`,
    pathname: `${id}.pdf`,
    contentType: "application/pdf",
    url: `https://files.example.com/${id}.pdf`,
    projectId: "p",
    threadId: "t",
  } as MediaFile
}

function createRegistry(
  transportFor: (key: string) => ChatTransport,
  options: { coordinator?: StreamCoordinator; maxIdle?: number } = {},
) {
  const coordinator = options.coordinator ?? new StreamCoordinator()
  const registry = new ChatRegistry({
    coordinator,
    maxIdle: options.maxIdle,
    create: (key, hooks) =>
      new PlaiChat({ transport: transportFor(key), ...hooks }),
  })
  return { registry, coordinator }
}

const file = () => new File(["x"], "x.pdf", { type: "application/pdf" })

describe("PlaiChat snapshots", () => {
  it("returns the same snapshot until the state changes and bumps the revision", async () => {
    const chat = new PlaiChat({ transport: controlledTransport([START, STOP]) })
    const first = chat.getState()
    expect(chat.getState()).toBe(first)
    expect(chat.getRevision()).toBe(0)

    await chat.sendMessage({ text: "hi" })

    expect(chat.getState()).not.toBe(first)
    expect(chat.getState()).toBe(chat.getState())
    expect(chat.getRevision()).toBeGreaterThan(0)
    expect(chat.getInitialState()).toBe(first)

    const before = chat.getRevision()
    chat.hydrate([])
    expect(chat.getRevision()).toBe(before + 1)
  })
})

describe("StreamCoordinator", () => {
  it("reserves synchronously and releases exactly once", () => {
    const coordinator = new StreamCoordinator({ maxActiveStreams: 1 })
    const listener = vi.fn()
    coordinator.subscribe(listener)
    const snapshot = coordinator.getSnapshot()

    const release = coordinator.tryAcquire()
    expect(release).not.toBeNull()
    expect(coordinator.tryAcquire()).toBeNull()
    expect(coordinator.getSnapshot()).toEqual({ occupied: 1, limit: 1 })
    expect(coordinator.getSnapshot()).not.toBe(snapshot)

    release?.()
    release?.()
    expect(coordinator.getSnapshot().occupied).toBe(0)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it("rejects invalid limits", () => {
    expect(() => new StreamCoordinator({ maxActiveStreams: 0 })).toThrow(
      RangeError,
    )
  })
})

describe("ChatRegistry", () => {
  it("keeps the instance and its stream alive without consumers", async () => {
    const gate = deferred()
    const { registry } = createRegistry(() =>
      controlledTransport([START, STOP], { gate: gate.promise }),
    )
    const chat = registry.getOrCreate("a")
    const release = registry.retain("a")

    const run = registry.runInvocation("a", (op) =>
      op.sendMessage({ text: "hi" }),
    )
    release()
    await flush()

    expect(registry.get("a")).toBe(chat)
    expect(registry.busyKeys().has("a")).toBe(true)

    gate.resolve()
    await run
    expect(chat.getState().status).toBe("ready")
    expect(registry.busyKeys().size).toBe(0)
  })

  it("shares the budget between registries and rejects before any request", async () => {
    const coordinator = new StreamCoordinator({ maxActiveStreams: 1 })
    const gate = deferred()
    const onStream = vi.fn()
    const upload = vi.fn(async () => mediaFile("m"))
    const one = createRegistry(
      () => controlledTransport([START, STOP], { gate: gate.promise }),
      { coordinator },
    ).registry
    const two = createRegistry(
      () => controlledTransport([START, STOP], { onStream, upload }),
      { coordinator },
    ).registry

    const first = one.runInvocation("a", (op) => op.sendMessage({ text: "1" }))
    const operation = vi.fn(async (op) => {
      await op.uploadFile(file())
    })
    await expect(two.runInvocation("b", operation)).rejects.toMatchObject({
      code: "capacity_exceeded",
    })
    expect(operation).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
    expect(onStream).not.toHaveBeenCalled()

    gate.resolve()
    await first
    expect(coordinator.getSnapshot().occupied).toBe(0)
    await two.runInvocation("b", (op) => op.sendMessage({ text: "2" }))
    expect(onStream).toHaveBeenCalledTimes(1)
  })

  it("admits only one of two racing invocations for the last slot", async () => {
    const coordinator = new StreamCoordinator({ maxActiveStreams: 1 })
    const { registry } = createRegistry(
      () => controlledTransport([START, STOP]),
      { coordinator },
    )
    const results = await Promise.allSettled([
      registry.runInvocation("a", (op) => op.sendMessage({ text: "a" })),
      registry.runInvocation("b", (op) => op.sendMessage({ text: "b" })),
    ])
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"])
  })

  it("rejects a second operation on the same key", async () => {
    const gate = deferred()
    const { registry } = createRegistry(() =>
      controlledTransport([START, STOP], { gate: gate.promise }),
    )
    const first = registry.runInvocation("a", (op) =>
      op.sendMessage({ text: "1" }),
    )
    await expect(
      registry.runInvocation("a", (op) => op.sendMessage({ text: "2" })),
    ).rejects.toBeInstanceOf(ChatRegistryError)
    gate.resolve()
    await first
  })

  it("keeps the entry between upload and send with maxIdle=0", async () => {
    const uploadGate = deferred<MediaFile>()
    const onStream = vi.fn()
    const { registry, coordinator } = createRegistry(
      () =>
        controlledTransport([START, STOP], {
          upload: () => uploadGate.promise,
          onStream,
        }),
      { maxIdle: 0 },
    )
    const chat = registry.getOrCreate("a")
    const unretain = registry.retain("a")

    const run = registry.runInvocation("a", async (op) => {
      const media = await op.uploadFile(file())
      await op.sendMessage({
        text: "with file",
        documents: [{ mediaFileId: media.id, filename: media.name }],
      })
    })
    unretain()
    await flush()
    expect(registry.get("a")).toBe(chat)

    uploadGate.resolve(mediaFile("m1"))
    await run
    expect(onStream).toHaveBeenCalledTimes(1)
    expect(coordinator.getSnapshot().occupied).toBe(0)

    await flush()
    expect(registry.has("a")).toBe(false)
  })

  it("never sends after a cancel or release between upload and send", async () => {
    for (const action of ["cancel", "release"] as const) {
      const uploadGate = deferred<MediaFile>()
      const onStream = vi.fn()
      const { registry, coordinator } = createRegistry(() =>
        controlledTransport([START, STOP], {
          // Ignores the abort signal, like a transport that resolves late.
          upload: () => uploadGate.promise,
          onStream,
        }),
      )
      const settled = vi.fn()
      registry.onSettled((_, result) => settled(result.outcome))

      const run = registry.runInvocation("a", async (op) => {
        await op.uploadFile(file())
        await op.sendMessage({ text: "late" })
      })
      await flush()
      registry[action]("a")
      if (action === "release") registry.getOrCreate("a")
      uploadGate.resolve(mediaFile("late"))

      await expect(run).rejects.toMatchObject({ name: "AbortError" })
      expect(onStream).not.toHaveBeenCalled()
      expect(settled).toHaveBeenCalledWith("cancelled")
      expect(coordinator.getSnapshot().occupied).toBe(0)
    }
  })

  it("reports a stream error followed by message_stop once, with the final state", async () => {
    const { registry, coordinator } = createRegistry(() =>
      controlledTransport([
        START,
        { type: "error", error: { type: "llm_error", message: "boom" } },
        STOP,
      ]),
    )
    const results: ChatInvocationSettled[] = []
    registry.onSettled((_, result) => results.push(result))

    await registry.runInvocation("a", (op) => op.sendMessage({ text: "x" }))

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      outcome: "error",
      didSend: true,
      error: { type: "llm_error", message: "boom" },
    })
    expect(results[0]?.state.status).toBe("error")
    expect(coordinator.getSnapshot().occupied).toBe(0)
  })

  it("settles an upload failure as an error and frees the slot", async () => {
    const { registry, coordinator } = createRegistry(() =>
      controlledTransport([START, STOP], {
        upload: async () => {
          throw new Error("upload failed")
        },
      }),
    )
    const outcomes: string[] = []
    registry.onSettled((_, result) => outcomes.push(result.outcome))

    await expect(
      registry.runInvocation("a", async (op) => {
        await op.uploadFile(file())
      }),
    ).rejects.toThrow("upload failed")
    expect(outcomes).toEqual(["error"])
    expect(coordinator.getSnapshot().occupied).toBe(0)
    expect(registry.busyKeys().size).toBe(0)
  })

  it("isolates throwing listeners from the stream and resource release", async () => {
    const onListenerError = vi.fn()
    const coordinator = new StreamCoordinator()
    const registry = new ChatRegistry({
      coordinator,
      onListenerError,
      create: (_, hooks) =>
        new PlaiChat({
          transport: controlledTransport([START, STOP]),
          ...hooks,
        }),
    })
    registry.onEvent(() => {
      throw new Error("event listener")
    })
    registry.onSettled(() => {
      throw new Error("settled listener")
    })

    await registry.runInvocation("a", (op) => op.sendMessage({ text: "x" }))

    expect(registry.get("a")?.getState().status).toBe("ready")
    expect(onListenerError).toHaveBeenCalled()
    expect(coordinator.getSnapshot().occupied).toBe(0)
  })

  it("lets an invocation send only once", async () => {
    const { registry } = createRegistry(() =>
      controlledTransport([START, STOP]),
    )
    await expect(
      registry.runInvocation("a", async (op) => {
        await op.sendMessage({ text: "1" })
        await op.sendMessage({ text: "2" })
      }),
    ).rejects.toThrow("only send one message")
  })

  it("evicts idle entries in LRU order, never retained or pending ones", async () => {
    const { registry } = createRegistry(() => controlledTransport([]), {
      maxIdle: 1,
    })
    for (const key of ["a", "b", "c"]) {
      registry.getOrCreate(key)
      registry.retain(key)()
    }
    registry.getOrCreate("d") // handed out, not retained yet
    await flush()

    expect(registry.has("a")).toBe(false)
    expect(registry.has("b")).toBe(false)
    expect(registry.has("c")).toBe(true)
    expect(registry.has("d")).toBe(true)
  })

  it("survives a StrictMode retain → release → retain with maxIdle=0", async () => {
    const { registry } = createRegistry(() => controlledTransport([]), {
      maxIdle: 0,
    })
    const chat = registry.getOrCreate("a")
    registry.retain("a")()
    const unretain = registry.retain("a")
    await flush()
    expect(registry.get("a")).toBe(chat)
    unretain()
    await flush()
    expect(registry.has("a")).toBe(false)
  })

  it("keeps busyKeys referentially stable between unrelated changes", async () => {
    const gate = deferred()
    const { registry } = createRegistry(() =>
      controlledTransport(
        [START, { type: "message_id", id: "x" } as never, STOP],
        {
          gate: gate.promise,
        },
      ),
    )
    const empty = registry.busyKeys()
    const run = registry.runInvocation("a", (op) =>
      op.sendMessage({ text: "x" }),
    )
    const busy = registry.busyKeys()
    expect(busy).not.toBe(empty)
    await flush()
    expect(registry.busyKeys()).toBe(busy)
    gate.resolve()
    await run
    expect(registry.busyKeys().size).toBe(0)
  })

  it("dispose cancels only its own entries and leaves the coordinator usable", async () => {
    const coordinator = new StreamCoordinator({ maxActiveStreams: 2 })
    const gate = deferred()
    const one = createRegistry(
      () => controlledTransport([START, STOP], { gate: gate.promise }),
      { coordinator },
    ).registry
    const two = createRegistry(() => controlledTransport([START, STOP]), {
      coordinator,
    }).registry

    const run = one.runInvocation("a", (op) => op.sendMessage({ text: "x" }))
    one.dispose()
    one.dispose()
    await run
    expect(coordinator.getSnapshot().occupied).toBe(0)
    expect(one.retain("a")).toBeTypeOf("function")
    expect(one.getOrCreate("a")).toBe(one.getOrCreate("a"))
    await expect(
      one.runInvocation("a", (op) => op.sendMessage({ text: "y" })),
    ).rejects.toMatchObject({ code: "disposed" })

    await two.runInvocation("b", (op) => op.sendMessage({ text: "z" }))
  })
})
