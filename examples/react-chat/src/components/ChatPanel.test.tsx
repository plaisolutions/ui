// @vitest-environment jsdom
import type { UIMessage } from "@plaisolutions/client"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ChatPanel } from "./ChatPanel"

const { useChatMock, getThreadMock } = vi.hoisted(() => ({
  useChatMock: vi.fn(),
  getThreadMock: vi.fn(),
}))

vi.mock("@plaisolutions/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@plaisolutions/react")>()),
  useChat: useChatMock,
}))

vi.mock("../api", () => ({ getThread: getThreadMock }))

const completedMessage: UIMessage = {
  id: "assistant-local",
  role: "assistant",
  parts: [{ type: "text", text: "Finished answer" }],
  metadata: { persistedMessageId: "assistant-saved", completed: true },
}

function mockChatState({
  messages = [completedMessage],
  status = "ready",
  uploadStatus = "idle",
}: {
  messages?: UIMessage[]
  status?: "ready" | "streaming"
  uploadStatus?: "idle" | "uploading"
} = {}) {
  useChatMock.mockReturnValue({
    messages,
    status,
    error: null,
    uploadState: {
      status: uploadStatus,
      fileName: uploadStatus === "uploading" ? "report.pdf" : null,
      loadedBytes: uploadStatus === "uploading" ? 50 : 0,
      totalBytes: uploadStatus === "uploading" ? 100 : 0,
      progress: uploadStatus === "uploading" ? 50 : 0,
      error: null,
    },
    sendMessage: vi.fn(),
    resendMessage: vi.fn(),
    rateMessage: vi.fn(),
    getMemoryProposal: vi.fn(),
    acceptMemoryProposal: vi.fn(),
    rejectMemoryProposal: vi.fn(),
    getResourceDownloadUrl: vi.fn(),
    transcribeAudio: vi.fn(),
    uploadFile: vi.fn(),
    stop: vi.fn(),
    hydrate: vi.fn(),
  })
}

function renderChatPanel() {
  render(
    <ChatPanel
      session={{
        id: "session",
        thread_id: "thread",
        agent_id: "agent",
        chat_token: "token",
      }}
      config={{
        api: "https://example.com",
        projectToken: "project-token",
        agentId: "agent",
        externalRef: "user",
      }}
      onDisconnect={vi.fn()}
    />,
  )
}

beforeEach(() => {
  getThreadMock.mockReturnValue(new Promise(() => {}))
  HTMLElement.prototype.scrollTo = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("ChatPanel response actions", () => {
  it("keeps actions for a completed answer while a new file uploads", () => {
    mockChatState({ uploadStatus: "uploading" })
    renderChatPanel()

    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Rate positively" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Retry" })).toHaveProperty(
      "disabled",
      true,
    )
  })

  it("hides actions for an active answer until it completes", () => {
    mockChatState({
      status: "streaming",
      messages: [
        completedMessage,
        { id: "user", role: "user", parts: [{ type: "text", text: "Next" }] },
        {
          id: "active",
          role: "assistant",
          parts: [{ type: "text", text: "Partial answer" }],
          metadata: { persistedMessageId: "active-saved", completed: false },
        },
      ],
    })
    renderChatPanel()

    expect(screen.getAllByRole("button", { name: "Copy" })).toHaveLength(1)
    expect(
      screen.getAllByRole("button", { name: "Rate positively" }),
    ).toHaveLength(1)
  })
})
