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

type XhrMock = XMLHttpRequest & {
  open: ReturnType<typeof vi.fn>
  setRequestHeader: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  abort: ReturnType<typeof vi.fn>
}

function createXhrMock({
  status = 201,
  statusText = "Created",
  responseText,
  loaded = 5,
  total = 10,
}: {
  status?: number
  statusText?: string
  responseText: string
  loaded?: number
  total?: number
}): XhrMock {
  const listeners = new Map<string, Array<(event: unknown) => void>>()
  const uploadListeners = new Map<string, Array<(event: unknown) => void>>()
  const addListener = (
    target: Map<string, Array<(event: unknown) => void>>,
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => {
    if (typeof listener !== "function") return
    target.set(type, [...(target.get(type) ?? []), listener as (event: unknown) => void])
  }
  const emit = (
    target: Map<string, Array<(event: unknown) => void>>,
    type: string,
    event: unknown = {},
  ) => {
    for (const listener of target.get(type) ?? []) listener(event)
  }

  const xhr = {
    status,
    statusText,
    responseText,
    withCredentials: false,
    upload: {
      addEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject,
      ) => addListener(uploadListeners, type, listener),
    },
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => addListener(listeners, type, listener),
    open: vi.fn(),
    setRequestHeader: vi.fn(),
    send: vi.fn(() => {
      queueMicrotask(() => {
        emit(uploadListeners, "progress", {
          lengthComputable: true,
          loaded,
          total,
        })
        emit(uploadListeners, "load")
        emit(listeners, "load")
      })
    }),
    abort: vi.fn(() => emit(listeners, "abort")),
  }

  return xhr as unknown as XhrMock
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
          {
            mediaFileId: "media_1",
            url: "https://example.com/preview.png",
            filename: "preview.png",
          },
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
          { media_file_id: "media_1", filename: "preview.png" },
        ],
      }),
    )
  })

  it("omits empty optional backend fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeStreamResponse('event: message_stop\ndata: {"type":"message_stop"}\n\n'),
    )
    const transport = new PlaiThreadTransport({ api: "https://api.plaisolutions.com/invoke", fetch: fetchMock })

    for await (const _event of transport.stream({
      messages: [],
      message: { text: "Hola", enabledTools: [], documents: [] },
      signal: new AbortController().signal,
    })) {
      // consume
    }

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(JSON.stringify({ prompt: "Hola" }))
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

  it("rates a message with the current session token", async () => {
    let token = "token-one"
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com/",
      chatSessionId: "session/1",
      threadId: "thread_1",
      headers: () => ({ Authorization: `Bearer ${token}` }),
      fetch: fetchMock,
    })

    await transport.rateMessage({
      messageId: "message_1",
      rating: "POSITIVE",
    })

    token = "token-two"
    await transport.rateMessage({
      messageId: "message_2",
      rating: "NEGATIVE",
    })

    const [firstUrl, firstInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Headers },
    ]
    const [, secondInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit & { headers: Headers },
    ]

    expect(firstUrl).toBe(
      "https://api.plaisolutions.com/chat_sessions/session%2F1/rate-message",
    )
    expect(firstInit.method).toBe("POST")
    expect(firstInit.headers.get("Authorization")).toBe("Bearer token-one")
    expect(firstInit.body).toBe(
      JSON.stringify({ message_id: "message_1", rating: "POSITIVE" }),
    )
    expect(secondInit.headers.get("Authorization")).toBe("Bearer token-two")
  })

  it("surfaces the expected 404 from the rate-message endpoint", async () => {
    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com",
      chatSessionId: "session_1",
      fetch: vi.fn().mockResolvedValue(
        new Response("Not Found", {
          status: 404,
          statusText: "Not Found",
        }),
      ),
    })

    await expect(
      transport.rateMessage({
        messageId: "message_1",
        rating: "POSITIVE",
      }),
    ).rejects.toMatchObject({ status: 404, body: "Not Found" })
  })

  it("requires a chat session id to rate messages", async () => {
    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com/invoke",
      fetch: vi.fn(),
    })

    await expect(
      transport.rateMessage({
        messageId: "message_1",
        rating: "POSITIVE",
      }),
    ).rejects.toThrow(/chatSessionId/)
  })

  it("transcribes audio with the current session token", async () => {
    let token = "token-one"
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify("Hola desde voz")),
      )
    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com/",
      chatSessionId: "session/1",
      headers: () => ({
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }),
      credentials: "include",
      fetch: fetchMock,
    })
    const signal = new AbortController().signal

    const transcription = await transport.transcribeAudio(
      new Blob(["audio"], { type: "audio/webm;codecs=opus" }),
      signal,
    )
    token = "token-two"
    await transport.transcribeAudio(new Blob(["more audio"]))

    expect(transcription).toBe("Hola desde voz")
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Headers; body: FormData },
    ]
    const file = init.body.get("file") as File

    expect(url).toBe(
      "https://api.plaisolutions.com/chat_sessions/session%2F1/transcriptions",
    )
    expect(init.method).toBe("POST")
    expect(init.credentials).toBe("include")
    expect(init.signal).toBe(signal)
    expect(init.headers.get("Authorization")).toBe("Bearer token-one")
    expect(init.headers.has("Content-Type")).toBe(false)
    expect(init.headers.get("Accept")).toBe("application/json")
    expect(file).toBeInstanceOf(Blob)
    expect(file.name).toBe("recording.webm")

    const [, secondInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit & { headers: Headers },
    ]
    expect(secondInit.headers.get("Authorization")).toBe("Bearer token-two")
  })

  it("rejects invalid transcription responses", async () => {
    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com",
      chatSessionId: "session_1",
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ text: "unexpected" })),
        ),
    })

    await expect(
      transport.transcribeAudio(new Blob(["audio"])),
    ).rejects.toThrow(/JSON string/)
  })

  it("throws HttpStatusError when audio transcription fails", async () => {
    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com",
      chatSessionId: "session_1",
      fetch: vi.fn().mockResolvedValue(
        new Response("Audio is too large", {
          status: 413,
          statusText: "Content Too Large",
        }),
      ),
    })

    await expect(
      transport.transcribeAudio(new Blob(["audio"])),
    ).rejects.toMatchObject({ status: 413, body: "Audio is too large" })
  })

  it("requires a chat session id to transcribe audio", async () => {
    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com/invoke",
      fetch: vi.fn(),
    })

    await expect(
      transport.transcribeAudio(new Blob(["audio"])),
    ).rejects.toThrow(/chatSessionId/)
  })

  it("uploads a thread media file with progress and dynamic authentication", async () => {
    const xhr = createXhrMock({
      responseText: JSON.stringify({
        id: "media_1",
        name: "report.pdf",
        pathname: "threads/thread_1/report.pdf",
        content_type: "application/pdf",
        url: "https://files.example.com/report.pdf",
        project_id: "project_1",
        thread_id: "thread_1",
        derived_from_media_file_id: null,
        anthropic_file_id: null,
        metadata: { pages: 2 },
        created_at: "2026-07-22T10:00:00Z",
        updated_at: "2026-07-22T10:00:01Z",
      }),
    })
    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com/",
      chatSessionId: "session/1",
      threadId: "thread/1",
      headers: async () => ({
        Authorization: "Bearer current-token",
        "Content-Type": "application/json",
      }),
      credentials: "include",
      xhr: () => xhr,
    })
    const onProgress = vi.fn()
    const onUploaded = vi.fn()
    const file = new File(["report"], "report.pdf", {
      type: "application/pdf",
    })

    const mediaFile = await transport.uploadFile({
      file,
      signal: new AbortController().signal,
      onProgress,
      onUploaded,
    })

    expect(mediaFile).toMatchObject({
      id: "media_1",
      name: "report.pdf",
      contentType: "application/pdf",
      projectId: "project_1",
      threadId: "thread_1",
      metadata: { pages: 2 },
    })
    expect(xhr.open).toHaveBeenCalledWith(
      "POST",
      "https://api.plaisolutions.com/chat_sessions/session%2F1/threads/thread%2F1/media-files",
    )
    expect(xhr.setRequestHeader).toHaveBeenCalledWith(
      "authorization",
      "Bearer current-token",
    )
    expect(xhr.setRequestHeader).not.toHaveBeenCalledWith(
      "content-type",
      expect.anything(),
    )
    expect(xhr.withCredentials).toBe(true)
    const body = xhr.send.mock.calls[0]?.[0] as FormData
    const uploadedFile = body.get("file") as File
    expect(uploadedFile.name).toBe("report.pdf")
    expect(uploadedFile.type).toBe("application/pdf")
    expect(await uploadedFile.text()).toBe("report")
    expect(onProgress).toHaveBeenCalledWith({
      loadedBytes: 5,
      totalBytes: 10,
      progress: 50,
    })
    expect(onUploaded).toHaveBeenCalledTimes(1)
  })

  it("rejects media file responses without an id", async () => {
    const xhr = createXhrMock({
      responseText: JSON.stringify({
        name: "report.pdf",
        pathname: "report.pdf",
        content_type: "application/pdf",
        url: "https://files.example.com/report.pdf",
        project_id: "project_1",
      }),
    })
    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com",
      chatSessionId: "session_1",
      threadId: "thread_1",
      xhr: () => xhr,
    })

    await expect(
      transport.uploadFile({
        file: new File(["report"], "report.pdf"),
        signal: new AbortController().signal,
        onProgress: vi.fn(),
        onUploaded: vi.fn(),
      }),
    ).rejects.toThrow(/required id field/)
  })

  it("throws HttpStatusError when a media upload fails", async () => {
    const xhr = createXhrMock({
      status: 413,
      statusText: "Content Too Large",
      responseText: "File is too large",
    })
    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com",
      chatSessionId: "session_1",
      threadId: "thread_1",
      xhr: () => xhr,
    })

    await expect(
      transport.uploadFile({
        file: new File(["report"], "report.pdf"),
        signal: new AbortController().signal,
        onProgress: vi.fn(),
        onUploaded: vi.fn(),
      }),
    ).rejects.toMatchObject({
      status: 413,
      body: "File is too large",
    })
  })

  it("requires session and thread ids to upload files", async () => {
    const transport = new PlaiThreadTransport({
      api: "https://api.plaisolutions.com",
      xhr: () => createXhrMock({ responseText: "{}" }),
    })

    await expect(
      transport.uploadFile({
        file: new File(["report"], "report.pdf"),
        signal: new AbortController().signal,
        onProgress: vi.fn(),
        onUploaded: vi.fn(),
      }),
    ).rejects.toThrow(/chatSessionId and threadId/)
  })
})
