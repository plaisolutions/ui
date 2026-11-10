import {
  type ToolConfirmationSnapshot,
  type ToolConfirmationState,
  type ToolDecisionError,
  ToolDecisionRejectedError,
  type UIToolCallPart,
} from "@plaisolutions/client"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ToolResultCard } from "../components"

const FAR = "2099-01-01T00:00:00Z"

const gmail = {
  provider: "google",
  capability: "gmail",
  label: "Gmail",
  account_email: "me@gmail.com",
}
const calendar = {
  provider: "google",
  capability: "google_calendar",
  label: "Google Calendar",
  account_email: "me@gmail.com",
}

function mailPart(
  editable = ["to", "cc", "subject", "body"],
  actionId = "a-1",
): UIToolCallPart {
  return {
    type: "tool-call",
    id: `tool_${actionId}`,
    name: "gmail_send",
    toolType: "personal_connector",
    input: {},
    state: "completed",
    result: "{}",
    metadata: {
      type: "personal_connector",
      connector: gmail,
      action: "send",
      pending_confirmation: {
        action_id: actionId,
        tool_name: "gmail_send",
        kind: "mail",
        operation: "send",
        editable,
        expires_at: FAR,
        state_version: 1,
        action: {
          operation: "send",
          to: ["ana@acme.com"],
          subject: "Hola",
          body: "Texto original",
        },
      },
    },
  }
}

function eventPart(): UIToolCallPart {
  return {
    type: "tool-call",
    id: "tool_e-1",
    name: "google_calendar_create_event",
    toolType: "personal_connector",
    input: {},
    state: "completed",
    result: "{}",
    metadata: {
      type: "personal_connector",
      connector: calendar,
      action: "create_event",
      pending_confirmation: {
        action_id: "e-1",
        tool_name: "google_calendar_create_event",
        kind: "calendar",
        operation: "create",
        editable: ["title", "start", "end", "location", "attendees"],
        expires_at: FAR,
        state_version: 1,
        action: {
          operation: "create_event",
          title: "Demo",
          start: "2027-11-15T10:00:00+01:00",
          end: "2027-11-15T11:00:00+01:00",
          time_zone: "Europe/Madrid",
        },
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
    effectiveAction: null,
    supersededBy: null,
    supersedes: null,
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

function rejection(actionId: string, errors: ToolDecisionError["errors"]) {
  return new ToolDecisionRejectedError(
    { actionId, errors },
    { type: "http_error", message: "HTTP 422", status: 422 },
  )
}

const click = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }))
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe("editing a held action from its card", () => {
  afterEach(cleanup)

  it("offers no Edit when the server declared nothing editable", () => {
    render(
      <ToolResultCard
        locale="en"
        part={mailPart([])}
        toolConfirmation={{ states: snapshot(state()), decide: vi.fn() }}
      />,
    )

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull()
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy()
  })

  it("opens a form with the prepared values and a save-and-send button", () => {
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{ states: snapshot(state()), decide: vi.fn() }}
      />,
    )

    click("Edit")

    expect((screen.getByLabelText("To") as HTMLInputElement).value).toBe(
      "ana@acme.com",
    )
    expect((screen.getByLabelText("Subject") as HTMLInputElement).value).toBe(
      "Hola",
    )
    expect(
      (screen.getByLabelText("Message") as HTMLTextAreaElement).value,
    ).toBe("Texto original")
    // Saving here runs the action: it says so.
    expect(screen.getByRole("button", { name: "Save and send" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull()
  })

  it("discards the draft without sending anything", () => {
    const decide = vi.fn(async () => {})
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{ states: snapshot(state()), decide }}
      />,
    )
    click("Edit")
    type("Subject", "Otro asunto")

    click("Discard changes")

    expect(screen.queryByLabelText("Subject")).toBeNull()
    expect(decide).not.toHaveBeenCalled()
    click("Edit")
    expect((screen.getByLabelText("Subject") as HTMLInputElement).value).toBe(
      "Hola",
    )
  })

  it("confirms with only the fields that changed", async () => {
    const decide = vi.fn(async () => {})
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{ states: snapshot(state()), decide }}
      />,
    )
    click("Edit")
    type("Subject", "Hola, Ana")
    type("Cc", "luis@acme.com, eva@acme.com")

    click("Save and send")

    await waitFor(() => expect(decide).toHaveBeenCalledTimes(1))
    expect(decide).toHaveBeenCalledWith([
      {
        action_id: "a-1",
        decision: "confirm",
        arguments: {
          subject: "Hola, Ana",
          cc: ["luis@acme.com", "eva@acme.com"],
        },
      },
    ])
  })

  it("saving without changes is a plain confirmation", async () => {
    const decide = vi.fn(async () => {})
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{ states: snapshot(state()), decide }}
      />,
    )
    click("Edit")

    click("Save and send")

    await waitFor(() => expect(decide).toHaveBeenCalled())
    expect(decide).toHaveBeenCalledWith([
      { action_id: "a-1", decision: "confirm" },
    ])
  })

  it("checks the fields on the device first and sends nothing when they are wrong", () => {
    const decide = vi.fn(async () => {})
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{ states: snapshot(state()), decide }}
      />,
    )
    click("Edit")
    type("To", "no-es-un-correo")
    type("Subject", "  ")

    click("Save and send")

    expect(decide).not.toHaveBeenCalled()
    const alerts = screen.getAllByRole("alert").map((node) => node.textContent)
    expect(alerts).toContain("Enter valid email addresses")
    expect(alerts).toContain("This field can’t be empty")
    expect(screen.getByLabelText("To").getAttribute("aria-invalid")).toBe(
      "true",
    )
    // Fixing a field clears its message.
    type("To", "ana@acme.com")
    expect(screen.getByLabelText("To").getAttribute("aria-invalid")).toBeNull()
  })

  it("keeps the draft and shows the server's field errors when it refuses the edit", async () => {
    const decide = vi.fn(async () => {
      throw rejection("a-1", [
        { field: "body", message: "must be plain text, without HTML" },
      ])
    })
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{ states: snapshot(state()), decide }}
      />,
    )
    click("Edit")
    type("Message", "<p>Hola</p>")

    click("Save and send")

    expect(
      await screen.findByText("must be plain text, without HTML"),
    ).toBeTruthy()
    expect(
      (screen.getByLabelText("Message") as HTMLTextAreaElement).value,
    ).toBe("<p>Hola</p>")
    // The buttons work again so the user can correct and retry.
    expect(
      (
        screen.getByRole("button", {
          name: "Save and send",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false)
  })

  it("does not blame the user's edit for any other failure", async () => {
    const decide = vi.fn(async () => {
      throw new Error("network")
    })
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{ states: snapshot(state()), decide }}
      />,
    )
    click("Edit")
    type("Subject", "Nuevo")

    click("Save and send")

    expect(
      await screen.findByText("Your decision couldn’t be sent. Try again."),
    ).toBeTruthy()
    expect((screen.getByLabelText("Subject") as HTMLInputElement).value).toBe(
      "Nuevo",
    )
  })

  it("says so when the edit no longer applies and leaves the form for correction", () => {
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{
          states: snapshot(state({ error: "invalid_edit" })),
          decide: vi.fn(),
        }}
      />,
    )

    expect(screen.getByText(/no longer apply to this action/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy()
  })

  it("disables the form and its buttons while the thread is busy", () => {
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{
          states: snapshot(state()),
          decide: vi.fn(),
          disabled: true,
        }}
      />,
    )

    expect(
      (screen.getByRole("button", { name: "Edit" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it("speaks the user's language", () => {
    render(
      <ToolResultCard
        locale="es"
        part={mailPart()}
        toolConfirmation={{ states: snapshot(state()), decide: vi.fn() }}
      />,
    )

    click("Editar")

    expect(
      screen.getByRole("button", { name: "Guardar y enviar" }),
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Descartar cambios" }),
    ).toBeTruthy()
    expect(screen.getByLabelText("Mensaje")).toBeTruthy()
  })
})

describe("editing a calendar event", () => {
  afterEach(cleanup)

  it("shows the times in the action's zone and sends them with its offset", async () => {
    const decide = vi.fn(async () => {})
    render(
      <ToolResultCard
        locale="en"
        part={eventPart()}
        toolConfirmation={{
          states: snapshot(state({ actionId: "e-1" })),
          decide,
        }}
      />,
    )
    click("Edit")

    expect((screen.getByLabelText("Starts") as HTMLInputElement).value).toBe(
      "2027-11-15T10:00",
    )
    expect(screen.getAllByText("Time zone: Europe/Madrid").length).toBe(2)

    type("Starts", "2027-11-15T11:00")
    type("Ends", "2027-11-15T12:00")
    click("Save and confirm")

    await waitFor(() => expect(decide).toHaveBeenCalled())
    expect(decide).toHaveBeenCalledWith([
      {
        action_id: "e-1",
        decision: "confirm",
        arguments: {
          start: "2027-11-15T11:00:00+01:00",
          end: "2027-11-15T12:00:00+01:00",
        },
      },
    ])
  })

  it("refuses a time that happens twice, naming the zone, and sends nothing", () => {
    const decide = vi.fn(async () => {})
    render(
      <ToolResultCard
        locale="en"
        part={eventPart()}
        toolConfirmation={{
          states: snapshot(state({ actionId: "e-1" })),
          decide,
        }}
      />,
    )
    click("Edit")
    type("Starts", "2027-10-31T02:30")

    click("Save and confirm")

    expect(decide).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toContain("Europe/Madrid")
  })

  it("refuses an end before the start", () => {
    const decide = vi.fn(async () => {})
    render(
      <ToolResultCard
        locale="en"
        part={eventPart()}
        toolConfirmation={{
          states: snapshot(state({ actionId: "e-1" })),
          decide,
        }}
      />,
    )
    click("Edit")
    type("Ends", "2027-11-15T09:00")

    click("Save and confirm")

    expect(decide).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toBe(
      "The end must be after the start",
    )
  })
})

describe("after an edit or a replacement", () => {
  afterEach(cleanup)

  it("shows what ran, not what was prepared", () => {
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{
          states: snapshot(
            state({
              status: "executed",
              stateVersion: 3,
              canConfirm: false,
              canReject: false,
              effectiveAction: {
                operation: "send",
                to: ["ana@acme.com"],
                subject: "Asunto revisado",
                body: "Texto original",
              },
            }),
          ),
          decide: vi.fn(),
        }}
      />,
    )

    expect(screen.getByText("Asunto revisado")).toBeTruthy()
    expect(screen.queryByText("Hola")).toBeNull()
    expect(screen.getByText("Edited")).toBeTruthy()
  })

  it("marks a replaced version and points to its successor", () => {
    const scrollIntoView = vi.fn()
    // jsdom has no layout: it only needs to be called on the successor's card.
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView
    const successor = mailPart(undefined, "a-2")
    render(
      <>
        <ToolResultCard
          locale="en"
          part={mailPart()}
          toolConfirmation={{
            states: snapshot(
              state({
                status: "superseded",
                stateVersion: 2,
                canConfirm: false,
                canReject: false,
                supersededBy: "a-2",
              }),
              state({ actionId: "a-2", supersedes: "a-1" }),
            ),
            decide: vi.fn(),
          }}
        />
        <ToolResultCard
          locale="en"
          part={successor}
          toolConfirmation={{
            states: snapshot(state({ actionId: "a-2", supersedes: "a-1" })),
            decide: vi.fn(),
          }}
        />
      </>,
    )

    expect(
      screen.getAllByText("Replaced by a newer version").length,
    ).toBeGreaterThan(0)
    expect(
      document
        .querySelector('[data-confirmation-action="a-1"]')
        ?.className.includes("opacity-60"),
    ).toBe(true)

    act(() => {
      click("See the newer version")
    })

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(
      document.querySelector('[data-confirmation-action="a-2"]'),
    )
  })
})
