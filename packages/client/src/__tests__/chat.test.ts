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
        if (signal.aborted) {
          throw new DOMException("Aborted", "AbortError")
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

  it("resends the user turn preceding an assistant response", async () => {
    const streamedInputs: unknown[] = []
    const transport: ChatTransport = {
      async *stream({ message }) {
        streamedInputs.push(message)
        yield {
          type: "message_start",
          message: {
            id: "assistant_retry",
            role: "assistant",
            model: "gpt-5.4-mini",
          },
        }
        yield { type: "message_stop" }
      },
    }
    const initialMessages = [
      {
        id: "user_original",
        role: "user" as const,
        parts: [
          {
            type: "input_file" as const,
            fileUrl: "https://example.com/report.pdf",
            title: "report.pdf",
            metadata: {
              mediaFileId: "media_1",
              originalFileName: "original-report.pdf",
            },
          },
          {
            type: "input_image" as const,
            url: "https://example.com/chart.png",
            title: "chart.png",
          },
          { type: "text" as const, text: "Review these files" },
        ],
      },
      {
        id: "assistant_local",
        role: "assistant" as const,
        parts: [{ type: "text" as const, text: "Original response" }],
        metadata: { persistedMessageId: "assistant_persisted" },
      },
    ]
    const chat = new PlaiChat({
      transport,
      initialMessages,
      generateId: () => "user_retry",
    })

    await chat.resendMessage({
      messageId: "assistant_persisted",
      enabledTools: ["tool_1"],
    })

    expect(streamedInputs).toEqual([
      {
        text: "Review these files",
        enabledTools: ["tool_1"],
        documents: [
          {
            mediaFileId: "media_1",
            url: "https://example.com/report.pdf",
            filename: "original-report.pdf",
          },
          {
            url: "https://example.com/chart.png",
            filename: "chart.png",
          },
        ],
      },
    ])
    expect(chat.getState().messages.map((message) => message.id)).toEqual([
      "user_original",
      "assistant_local",
      "user_retry",
      "assistant_retry",
    ])
    expect(chat.getState().messages[1]?.parts).toEqual([
      { type: "text", text: "Original response" },
    ])
  })

  it("rejects resend requests without a matching assistant turn", async () => {
    const chat = new PlaiChat({
      transport: createTransport([]),
      initialMessages: [
        {
          id: "user_1",
          role: "user",
          parts: [{ type: "text", text: "Hello" }],
        },
      ],
    })

    await expect(chat.resendMessage({ messageId: "missing" })).rejects.toThrow(
      /assistant message was not found/,
    )
  })

  it("rejects assistant responses without a preceding user message", async () => {
    const chat = new PlaiChat({
      transport: createTransport([]),
      initialMessages: [
        {
          id: "assistant_1",
          role: "assistant",
          parts: [{ type: "text", text: "Welcome" }],
        },
      ],
    })

    await expect(
      chat.resendMessage({ messageId: "assistant_1" }),
    ).rejects.toThrow(/no preceding user message was found/)
  })

  it("creates user parts from documents before text", async () => {
    const chat = new PlaiChat({
      transport: createTransport([{ type: "message_stop" }]),
      generateId: () => "user_docs_1",
    })

    await chat.sendMessage({
      text: "Please review these files",
      documents: [
        {
          url: "https://example.com/files/diagram.png",
          filename: "diagram.png",
        },
        {
          url: "https://example.com/files/report.docx",
          filename: "report.docx",
        },
      ],
    })

    const state = chat.getState()
    expect(state.messages[0].id).toBe("user_docs_1")
    expect(state.messages[0].parts).toEqual([
      {
        type: "input_image",
        url: "https://example.com/files/diagram.png",
        title: "diagram.png",
        metadata: { originalFileName: "diagram.png" },
      },
      {
        type: "input_file",
        fileUrl: "https://example.com/files/report.docx",
        title: "report.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        metadata: { originalFileName: "report.docx" },
      },
      {
        type: "text",
        text: "Please review these files",
      },
    ])
  })

  it("supports sending documents without text", async () => {
    const chat = new PlaiChat({
      transport: createTransport([{ type: "message_stop" }]),
      generateId: () => "user_docs_2",
    })

    await chat.sendMessage({
      text: "",
      documents: [{ url: "https://example.com/files/manual.pdf" }],
    })

    const state = chat.getState()
    expect(state.messages[0].id).toBe("user_docs_2")
    expect(state.messages[0].parts).toEqual([
      {
        type: "input_file",
        fileUrl: "https://example.com/files/manual.pdf",
        title: "manual.pdf",
        mimeType: "application/pdf",
        metadata: { originalFileName: "manual.pdf" },
      },
    ])
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
    await new Promise((resolve) => setTimeout(resolve, 70))
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

  it("reports a recoverable protocol error when the stream ends without message_stop", async () => {
    const chat = new PlaiChat({
      transport: createTransport([
        {
          type: "message_start",
          message: { id: "msg_a", role: "assistant", model: "gpt-4o" },
        },
      ]),
    })

    await chat.sendMessage({ text: "Hello" })
    expect(chat.getState().error?.type).toBe("protocol_error")

    chat.clearError()
    expect(chat.getState().status).toBe("ready")
  })

  it("delegates message ratings to its session-aware transport", async () => {
    const rateMessage = vi.fn().mockResolvedValue(undefined)
    const chat = new PlaiChat({
      transport: {
        ...createTransport([]),
        rateMessage,
      },
    })

    await chat.rateMessage({
      messageId: "message_1",
      rating: "POSITIVE",
    })

    expect(rateMessage).toHaveBeenCalledWith({
      messageId: "message_1",
      rating: "POSITIVE",
    })
  })

  it("reports when the configured transport cannot rate messages", async () => {
    const chat = new PlaiChat({ transport: createTransport([]) })

    await expect(
      chat.rateMessage({
        messageId: "message_1",
        rating: "NEGATIVE",
      }),
    ).rejects.toThrow(/does not support message ratings/)
  })

  it("delegates audio transcription to its session-aware transport", async () => {
    const transcribeAudio = vi.fn().mockResolvedValue("Hola desde voz")
    const chat = new PlaiChat({
      transport: {
        ...createTransport([]),
        transcribeAudio,
      },
    })
    const audio = new Blob(["audio"], { type: "audio/webm" })
    const signal = new AbortController().signal

    await expect(chat.transcribeAudio(audio, signal)).resolves.toBe(
      "Hola desde voz",
    )
    expect(transcribeAudio).toHaveBeenCalledWith(audio, signal)
  })

  it("reports when the configured transport cannot transcribe audio", async () => {
    const chat = new PlaiChat({ transport: createTransport([]) })

    await expect(chat.transcribeAudio(new Blob(["audio"]))).rejects.toThrow(
      /does not support audio transcription/,
    )
  })

  it("tracks upload progress and processing in public chat state", async () => {
    const uploadFile: NonNullable<ChatTransport["uploadFile"]> = vi
      .fn()
      .mockImplementation(async ({ onProgress, onUploaded }) => {
        onProgress({ loadedBytes: 4, totalBytes: 10, progress: 40 })
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
      })
    const chat = new PlaiChat({
      transport: { ...createTransport([]), uploadFile },
    })
    const observedStatuses: string[] = []
    chat.subscribe((state) => observedStatuses.push(state.uploadState.status))
    const file = new File(["report"], "report.pdf", {
      type: "application/pdf",
    })

    const mediaFile = await chat.uploadFile(file)

    expect(mediaFile.id).toBe("media_1")
    expect(observedStatuses).toEqual([
      "uploading",
      "uploading",
      "processing",
      "idle",
    ])
    expect(chat.getState().uploadState).toMatchObject({
      status: "idle",
      progress: 0,
      error: null,
    })
  })

  it("keeps upload errors separate from the message status", async () => {
    const chat = new PlaiChat({
      transport: {
        ...createTransport([]),
        async uploadFile() {
          throw new TypeError("Upload network failed")
        },
      },
    })

    await expect(
      chat.uploadFile(new File(["report"], "report.pdf")),
    ).rejects.toThrow("Upload network failed")
    expect(chat.getState().status).toBe("ready")
    expect(chat.getState().error).toBeNull()
    expect(chat.getState().uploadState).toMatchObject({
      status: "error",
      fileName: "report.pdf",
      error: { type: "network_error" },
    })
  })

  it("aborts an active upload through stop", async () => {
    const chat = new PlaiChat({
      transport: {
        ...createTransport([]),
        uploadFile: ({ signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            )
          }),
      },
    })
    const uploading = chat.uploadFile(new File(["report"], "report.pdf"))

    chat.stop()

    await expect(uploading).rejects.toThrow(/Aborted/)
    expect(chat.getState().uploadState.status).toBe("idle")
  })

  it("reports when the configured transport cannot upload files", async () => {
    const chat = new PlaiChat({ transport: createTransport([]) })

    await expect(
      chat.uploadFile(new File(["report"], "report.pdf")),
    ).rejects.toThrow(/does not support file uploads/)
  })

  it("renders uploaded media references in the optimistic user message", async () => {
    const chat = new PlaiChat({
      transport: createTransport([{ type: "message_stop" }]),
    })

    await chat.sendMessage({
      text: "Review this",
      documents: [
        {
          mediaFileId: "media_1",
          url: "https://files.example.com/chart.png",
          filename: "chart.png",
        },
      ],
    })

    expect(chat.getState().messages[0].parts[0]).toMatchObject({
      type: "input_image",
      url: "https://files.example.com/chart.png",
      metadata: { mediaFileId: "media_1" },
    })
  })
})
