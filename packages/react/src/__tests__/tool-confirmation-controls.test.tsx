import {
  PlaiChat,
  type ToolConfirmationSnapshot,
  type ToolConfirmationState,
  type UIMessage,
  type UIToolCallPart,
} from "@plaisolutions/client"
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Message, ToolResultCard } from "../components"
import { useToolConfirmationSync } from "../use-tool-confirmations"

const gmail = {
  provider: "google",
  capability: "gmail",
  label: "Gmail",
  account_email: "me@gmail.com",
}

const FAR = "2099-01-01T00:00:00Z"

function pendingPart(
  operation: "send" | "delete" = "send",
  actionId = "a-1",
): UIToolCallPart {
  const calendar = operation === "delete"
  return {
    type: "tool-call",
    id: `tool_${actionId}`,
    name: calendar ? "google_calendar_delete_event" : "gmail_send",
    toolType: "personal_connector",
    input: {},
    state: "completed",
    result: "{}",
    metadata: {
      type: "personal_connector",
      connector: calendar
        ? { ...gmail, capability: "google_calendar", label: "Google Calendar" }
        : gmail,
      action: calendar ? "delete_event" : "send",
      pending_confirmation: {
        action_id: actionId,
        tool_name: calendar ? "google_calendar_delete_event" : "gmail_send",
        kind: calendar ? "calendar" : "mail",
        operation,
        editable: [],
        expires_at: FAR,
        state_version: 1,
        action: calendar
          ? { operation: "delete_event", event_id: "e-1" }
          : { operation: "send", to: ["ana@acme.com"], subject: "Hola" },
      },
    },
  }
}

function state(
  overrides: Partial<ToolConfirmationState> = {},
): ToolConfirmationState {
  return {
    actionId: "a-1",
    toolName: "gmail_send",
    status: "pending",
    stateVersion: 1,
    expiresAt: FAR,
    canConfirm: true,
    canReject: true,
    error: null,
    metadata: null,
    pendingConfirmation: null,
    source: "server",
    ...overrides,
  }
}

function snapshot(...items: ToolConfirmationState[]): ToolConfirmationSnapshot {
  return {
    items: Object.fromEntries(items.map((item) => [item.actionId, item])),
    serverOffsetMs: 0,
  }
}

describe("confirmation buttons on pending cards", () => {
  afterEach(cleanup)

  it("keeps the text hint when the host does not enable decisions", () => {
    render(<ToolResultCard locale="en" part={pendingPart()} />)

    expect(screen.getByText(/Reply “yes” to confirm/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull()
  })

  it("offers no decision until the server state is known", () => {
    render(
      <ToolResultCard
        locale="en"
        part={pendingPart()}
        toolConfirmation={{ states: snapshot(), decide: vi.fn() }}
      />,
    )

    expect(screen.getByText("Checking status…")).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("confirms with the operation's verb and shows progress", async () => {
    let finish: () => void = () => {}
    const decide = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    render(
      <ToolResultCard
        locale="en"
        part={pendingPart()}
        toolConfirmation={{ states: snapshot(state()), decide }}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    expect(decide).toHaveBeenCalledWith([
      { action_id: "a-1", decision: "confirm" },
    ])
    expect(screen.getByText("Confirming…")).toBeTruthy()
    expect(
      (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    await act(async () => finish())
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy()
  })

  it("cancels with reject", () => {
    const decide = vi.fn(async () => {})
    render(
      <ToolResultCard
        locale="en"
        part={pendingPart()}
        toolConfirmation={{ states: snapshot(state()), decide }}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(decide).toHaveBeenCalledWith([
      { action_id: "a-1", decision: "reject" },
    ])
  })

  it("uses a destructive Delete button for deletions, in the user's language", () => {
    render(
      <ToolResultCard
        locale="es"
        part={pendingPart("delete")}
        toolConfirmation={{ states: snapshot(state()), decide: vi.fn() }}
      />,
    )

    const button = screen.getByRole("button", { name: "Eliminar" })
    expect(button.className).toContain("bg-danger")
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy()
  })

  it("disables the buttons while the thread is busy", () => {
    render(
      <ToolResultCard
        locale="en"
        part={pendingPart()}
        toolConfirmation={{
          states: snapshot(state()),
          decide: vi.fn(),
          disabled: true,
        }}
      />,
    )

    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it("shows the outcome instead of buttons once decided", () => {
    render(
      <ToolResultCard
        locale="en"
        part={pendingPart()}
        toolConfirmation={{
          states: snapshot(state({ status: "executed", stateVersion: 3 })),
          decide: vi.fn(),
        }}
      />,
    )

    expect(screen.getAllByText("Done").length).toBeGreaterThan(0)
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("expires with the server clock", () => {
    render(
      <ToolResultCard
        locale="en"
        part={pendingPart()}
        toolConfirmation={{
          states: snapshot(state({ expiresAt: "2000-01-01T00:00:00Z" })),
          decide: vi.fn(),
        }}
      />,
    )

    expect(
      screen.getAllByText("Expired: ask again in the chat").length,
    ).toBeGreaterThan(0)
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("explains an unavailable tool and lets the user try again", () => {
    render(
      <ToolResultCard
        locale="en"
        part={pendingPart()}
        toolConfirmation={{
          states: snapshot(state({ error: "tool_unavailable" })),
          decide: vi.fn(),
        }}
      />,
    )

    expect(
      screen.getByText("The tool for this action isn’t available right now"),
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy()
  })
})

describe("confirmation outcomes", () => {
  afterEach(cleanup)

  it("describes actions that did not run", () => {
    render(
      <ToolResultCard
        locale="en"
        part={{
          type: "tool-call",
          id: "call_1",
          name: "confirm_pending_actions",
          toolType: "tool_confirmation",
          input: {},
          state: "completed",
          result: "{}",
          metadata: {
            type: "tool_confirmation",
            actions: [
              { action_id: "a-1", tool_name: "gmail_send", status: "rejected" },
              {
                action_id: "a-2",
                tool_name: "gmail_send",
                status: "pending",
                error: "tool_unavailable",
              },
            ],
          },
        }}
      />,
    )

    expect(screen.getByText("Cancelled: gmail_send")).toBeTruthy()
    expect(
      screen.getByText(
        "The tool for this action isn’t available right now: gmail_send",
      ),
    ).toBeTruthy()
  })
})

describe("hidden decision messages", () => {
  afterEach(cleanup)

  it("are not rendered", () => {
    const message: UIMessage = {
      id: "u1",
      role: "user",
      parts: [
        {
          type: "text",
          text: "[Decisions from the action cards] a-1: confirm",
        },
      ],
      metadata: { metadata: { hidden: true } },
    }
    const { container } = render(<Message message={message} />)

    expect(container.textContent).toBe("")
  })
})

describe("useToolConfirmationSync", () => {
  afterEach(cleanup)

  it("reads the state of shown actions on mount", async () => {
    const getToolConfirmations = vi.fn(async () => ({
      server_time: new Date().toISOString(),
      items: [
        {
          action_id: "a-1",
          tool_name: "gmail_send",
          status: "rejected" as const,
          state_version: 2,
          expires_at: FAR,
          can_confirm: false,
          can_reject: false,
        },
      ],
    }))
    const chat = new PlaiChat({
      transport: { stream: async function* () {}, getToolConfirmations },
      initialMessages: [
        { id: "m1", role: "assistant", parts: [pendingPart()] },
      ],
    })

    renderHook(() => useToolConfirmationSync(chat))

    await waitFor(() =>
      expect(chat.toolConfirmations.get("a-1")?.status).toBe("rejected"),
    )
    expect(getToolConfirmations).toHaveBeenCalledWith(
      expect.objectContaining({ actionIds: ["a-1"] }),
    )
  })

  it("keeps the error when the server cannot be read", async () => {
    const chat = new PlaiChat({
      transport: {
        stream: async function* () {},
        getToolConfirmations: vi.fn(async () => {
          throw new Error("offline")
        }),
      },
      initialMessages: [
        { id: "m1", role: "assistant", parts: [pendingPart()] },
      ],
    })

    const { result } = renderHook(() => useToolConfirmationSync(chat))

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
    expect(chat.toolConfirmations.get("a-1")).toBeUndefined()
  })
})
