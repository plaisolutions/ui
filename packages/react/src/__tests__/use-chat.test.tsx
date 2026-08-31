import { renderHook, act, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ChatTransport, PlaiSseEvent } from "@plaisolutions/client"
import { useChat } from "../use-chat"

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

describe("useChat", () => {
  it("returns initial ready state", () => {
    const transport = createTransport([])
    const { result } = renderHook(() => useChat({ transport }))

    expect(result.current.status).toBe("ready")
    expect(result.current.messages).toEqual([])
    expect(result.current.error).toBeNull()
    expect(result.current.uploadState.status).toBe("idle")
  })

  it("updates messages through sendMessage", async () => {
    const transport = createTransport([
      {
        type: "message_start",
        message: { id: "msg_a", role: "assistant", model: "gpt-4o" },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "text" },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "Hola" },
      },
      {
        type: "message_stop",
      },
    ])

    const { result } = renderHook(() => useChat({ transport }))

    await act(async () => {
      await result.current.sendMessage({ text: "Hello" })
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1].parts[0]).toEqual({
      type: "text",
      text: "Hola",
    })
  })

  it("rerenders while streaming", async () => {
    const transport = createTransport(
      [
        {
          type: "message_start",
          message: { id: "msg_a", role: "assistant", model: "gpt-4o" },
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
          type: "message_stop",
        },
      ],
      15,
    )

    const { result } = renderHook(() => useChat({ transport }))

    act(() => {
      void result.current.sendMessage({ text: "Hello" })
    })

    await waitFor(() => {
      expect(result.current.status).toBe("streaming")
    })

    await waitFor(() => {
      expect(result.current.status).toBe("ready")
      expect(result.current.messages[1].parts[0]).toEqual({
        type: "text",
        text: "partial",
      })
    })
  })

  it("aborts streaming on unmount (cleanup stop)", async () => {
    const transport = createTransport(
      [
        {
          type: "message_start",
          message: { id: "msg_a", role: "assistant", model: "gpt-4o" },
        },
        {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text" },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "A" },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "B" },
        },
        {
          type: "message_stop",
        },
      ],
      20,
    )

    const { result, unmount } = renderHook(() => useChat({ transport }))

    act(() => {
      void result.current.sendMessage({ text: "Hello" })
    })

    await waitFor(() => {
      expect(result.current.status).toBe("streaming")
    })

    unmount()
  })

  it("exposes errors to consuming component state", async () => {
    const transport: ChatTransport = {
      async *stream() {
        yield* []
        throw new TypeError("Network failed")
      },
    }

    const { result } = renderHook(() => useChat({ transport }))

    await act(async () => {
      await result.current.sendMessage({ text: "Hello" })
    })

    expect(result.current.error?.type).toBe("network_error")
    expect(result.current.status).toBe("error")
  })

  it("calls onEvent and onError callbacks when provided", async () => {
    const onEvent = vi.fn()
    const onError = vi.fn()

    const events: PlaiSseEvent[] = [
      {
        type: "message_start",
        message: { id: "msg_a", role: "assistant", model: "gpt-4o" },
      },
      {
        type: "message_stop",
      },
    ]

    const { result, rerender } = renderHook(
      ({ transport }) => useChat({ transport, onEvent, onError }),
      {
        initialProps: { transport: createTransport(events) },
      },
    )

    await act(async () => {
      await result.current.sendMessage({ text: "hello" })
    })

    expect(onEvent).toHaveBeenCalled()

    rerender({
      transport: {
        async *stream() {
          yield* []
          throw new TypeError("fail")
        },
      },
    })

    await act(async () => {
      await result.current.sendMessage({ text: "again" })
    })

    expect(onError).toHaveBeenCalled()
  })

  it("exposes rateMessage from the chat instance", async () => {
    const rateMessage = vi.fn().mockResolvedValue(undefined)
    const transport: ChatTransport = {
      ...createTransport([]),
      rateMessage,
    }
    const { result } = renderHook(() => useChat({ transport }))

    await act(async () => {
      await result.current.rateMessage({
        messageId: "message_1",
        rating: "NEGATIVE",
      })
    })

    expect(rateMessage).toHaveBeenCalledWith({
      messageId: "message_1",
      rating: "NEGATIVE",
    })
  })

  it("exposes resendMessage from the chat instance", async () => {
    const transport = createTransport([
      {
        type: "message_start",
        message: { id: "assistant_2", role: "assistant", model: "gpt-4o" },
      },
      { type: "message_stop" },
    ])
    const { result } = renderHook(() =>
      useChat({
        transport,
        initialMessages: [
          {
            id: "user_1",
            role: "user",
            parts: [{ type: "text", text: "Hello" }],
          },
          {
            id: "assistant_1",
            role: "assistant",
            parts: [{ type: "text", text: "Hi" }],
          },
        ],
      }),
    )

    await act(async () => {
      await result.current.resendMessage({ messageId: "assistant_1" })
    })

    expect(result.current.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
    ])
    expect(result.current.messages[2]?.parts).toEqual([
      { type: "text", text: "Hello" },
    ])
  })

  it("exposes transcribeAudio from the chat instance", async () => {
    const transcribeAudio = vi.fn().mockResolvedValue("Hola desde voz")
    const transport: ChatTransport = {
      ...createTransport([]),
      transcribeAudio,
    }
    const { result } = renderHook(() => useChat({ transport }))
    const audio = new Blob(["audio"], { type: "audio/webm" })
    const signal = new AbortController().signal

    await expect(result.current.transcribeAudio(audio, signal)).resolves.toBe(
      "Hola desde voz",
    )
    expect(transcribeAudio).toHaveBeenCalledWith(audio, signal)
  })

  it("exposes uploadFile and reactive uploadState", async () => {
    let finishUpload: (() => void) | undefined
    const uploadFile: NonNullable<ChatTransport["uploadFile"]> = async ({
      onProgress,
      onUploaded,
    }) => {
      onProgress({ loadedBytes: 25, totalBytes: 100, progress: 25 })
      await new Promise<void>((resolve) => {
        finishUpload = resolve
      })
      onUploaded()
      return {
        id: "media_1",
        name: "report.pdf",
        pathname: "report.pdf",
        contentType: "application/pdf",
        url: "https://files.example.com/report.pdf",
        projectId: "project_1",
        threadId: "thread_1",
        derivedFromMediaFileId: null,
        anthropicFileId: null,
        metadata: {},
      }
    }
    const transport: ChatTransport = {
      ...createTransport([]),
      uploadFile,
    }
    const { result } = renderHook(() => useChat({ transport }))
    let uploading: Promise<unknown> | undefined

    act(() => {
      uploading = result.current.uploadFile(
        new File(["report"], "report.pdf", { type: "application/pdf" }),
      )
    })

    await waitFor(() => {
      expect(result.current.uploadState).toMatchObject({
        status: "uploading",
        fileName: "report.pdf",
        progress: 25,
      })
    })

    await act(async () => {
      finishUpload?.()
      await uploading
    })

    expect(result.current.uploadState.status).toBe("idle")
  })
})
