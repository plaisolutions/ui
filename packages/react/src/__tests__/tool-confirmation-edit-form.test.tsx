import {
  type ToolConfirmationSnapshot,
  type ToolConfirmationState,
  type ToolDecisionError,
  ToolDecisionRejectedError,
  ToolSubmissionConflictError,
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
    // It folds into one line: what it was and a way to the new one, not the whole card.
    const folded = document.querySelector('[data-confirmation-action="a-1"]')
    expect(folded?.getAttribute("data-confirmation-status")).toBe("superseded")
    expect(folded?.textContent).toContain("Hola")
    expect(folded?.textContent).not.toContain("Texto original")
    expect(folded?.querySelector("button")?.textContent).toBe(
      "See the newer version",
    )

    act(() => {
      click("See the newer version")
    })

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(
      document.querySelector('[data-confirmation-action="a-2"]'),
    )
  })

  it("flashes the successor so the eye finds it, and stops after a moment", () => {
    vi.useFakeTimers()
    try {
      window.HTMLElement.prototype.scrollIntoView = vi.fn()
      render(
        <>
          <ToolResultCard
            locale="en"
            part={mailPart()}
            toolConfirmation={{
              states: snapshot(
                state({
                  status: "superseded",
                  canConfirm: false,
                  canReject: false,
                  supersededBy: "a-2",
                }),
                state({ actionId: "a-2" }),
              ),
              decide: vi.fn(),
            }}
          />
          <ToolResultCard
            locale="en"
            part={mailPart(undefined, "a-2")}
            toolConfirmation={{
              states: snapshot(state({ actionId: "a-2" })),
              decide: vi.fn(),
            }}
          />
        </>,
      )
      const target = document.querySelector('[data-confirmation-action="a-2"]')

      click("See the newer version")
      expect(target?.classList.contains("ring-2")).toBe(true)
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(target?.classList.contains("ring-2")).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it("does nothing, and does not break, when the successor is not on screen", () => {
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{
          states: snapshot(
            state({
              status: "superseded",
              canConfirm: false,
              canReject: false,
              supersededBy: "not-loaded",
            }),
          ),
          decide: vi.fn(),
        }}
      />,
    )

    expect(() => click("See the newer version")).not.toThrow()
  })
})

describe("the result of replace_pending_action", () => {
  afterEach(cleanup)

  /** What the server sends when the model replaces a pending mail: a tool_confirmation
   * result that carries the new version with the connector's metadata. */
  function replacePart(
    actionId: string,
    subject: string,
    supersedes = "a-1",
  ): UIToolCallPart {
    const prepared = mailPart(undefined, actionId)
    const metadata = prepared.metadata as {
      pending_confirmation: Record<string, unknown>
    }
    return {
      ...prepared,
      id: `tool_replace_${actionId}`,
      name: "replace_pending_action",
      toolType: "tool_confirmation",
      metadata: {
        ...metadata,
        pending_confirmation: {
          ...metadata.pending_confirmation,
          supersedes_action_id: supersedes,
          action: {
            operation: "send",
            to: ["ana@acme.com"],
            subject,
            body: "Texto",
          },
        },
        superseded: {
          action_id: supersedes,
          status: "superseded",
          superseded_by_action_id: actionId,
        },
      },
    } as UIToolCallPart
  }

  it("looks like the mail it carries, not like an anonymous tool with JSON arguments", () => {
    render(
      <ToolResultCard
        locale="en"
        part={replacePart("a-2", "Versión 2")}
        toolConfirmation={{
          states: snapshot(state({ actionId: "a-2" })),
          decide: vi.fn(),
        }}
      />,
    )

    // The mail card: its account, its subject, and the same buttons as preparing it.
    expect(screen.getByText("Gmail")).toBeTruthy()
    expect(screen.getByText("Versión 2")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy()
    // None of the generic card's tell-tales.
    expect(screen.queryByText("replace_pending_action")).toBeNull()
    expect(
      document.querySelector(".plai-tool-result-pending-confirmation-card"),
    ).toBeNull()
    expect(
      document.querySelector('[data-confirmation-action="a-2"]'),
    ).toBeTruthy()
  })

  it("is decided like any other mail: the buttons act on the new version", async () => {
    const decide = vi.fn(async () => {})
    render(
      <ToolResultCard
        locale="en"
        part={replacePart("a-2", "Versión 2")}
        toolConfirmation={{
          states: snapshot(state({ actionId: "a-2" })),
          decide,
        }}
      />,
    )

    click("Send")

    await waitFor(() => expect(decide).toHaveBeenCalled())
    expect(decide).toHaveBeenCalledWith([
      { action_id: "a-2", decision: "confirm" },
    ])
  })

  it("folds like any other version when a later replacement supersedes it, and leads to it", () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    render(
      <>
        <ToolResultCard
          locale="en"
          part={replacePart("a-2", "Versión 2")}
          toolConfirmation={{
            states: snapshot(
              state({
                actionId: "a-2",
                status: "superseded",
                canConfirm: false,
                canReject: false,
                supersededBy: "a-3",
              }),
              state({ actionId: "a-3" }),
            ),
            decide: vi.fn(),
          }}
        />
        <ToolResultCard
          locale="en"
          part={replacePart("a-3", "Versión 3", "a-2")}
          toolConfirmation={{
            states: snapshot(state({ actionId: "a-3" })),
            decide: vi.fn(),
          }}
        />
      </>,
    )

    const folded = document.querySelector('[data-confirmation-action="a-2"]')
    expect(folded?.getAttribute("data-confirmation-status")).toBe("superseded")
    expect(folded?.textContent).toContain("Versión 2")
    // The link now finds its target: both versions are the same kind of card.
    act(() => {
      click("See the newer version")
    })
    expect(
      (window.HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>)
        .mock.contexts[0],
    ).toBe(document.querySelector('[data-confirmation-action="a-3"]'))
  })

  it("keeps the generic card for any other held tool", () => {
    const generic = {
      type: "tool-call",
      id: "tool_h",
      name: "create_contact",
      toolType: "http_request",
      input: {},
      state: "completed",
      result: "{}",
      metadata: {
        pending_confirmation: {
          action_id: "h-1",
          tool_name: "create_contact",
          kind: "generic",
          action: { name: "Ana" },
        },
      },
    } as UIToolCallPart

    render(
      <ToolResultCard
        locale="en"
        part={generic}
        toolConfirmation={{
          states: snapshot(state({ actionId: "h-1" })),
          decide: vi.fn(),
        }}
      />,
    )

    expect(screen.getByText("create_contact")).toBeTruthy()
    // It leads somewhere too, so another card can point to it.
    expect(
      document.querySelector('[data-confirmation-action="h-1"]'),
    ).toBeTruthy()
  })
})

describe("why an action was invalidated or left unknown", () => {
  afterEach(cleanup)

  const closed = (
    status: ToolConfirmationState["status"],
    error: string | null,
  ) =>
    state({
      status,
      stateVersion: 3,
      canConfirm: false,
      canReject: false,
      error,
    })

  const show = (locale: string, item: ToolConfirmationState) =>
    render(
      <ToolResultCard
        locale={locale}
        part={mailPart()}
        toolConfirmation={{ states: snapshot(item), decide: vi.fn() }}
      />,
    )

  it.each([
    ["configuration_changed", /tool, account or its settings changed/],
    ["no_snapshot", /prepared by an older version/],
    [
      "resource_changed",
      /event changed after this was prepared, so nothing was modified/,
    ],
  ])("explains an invalidated action: %s", (reason, text) => {
    show("en", closed("invalidated", reason))

    // The status label stays, and the reason goes under it.
    expect(
      screen.getAllByText("Can no longer run: ask again").length,
    ).toBeGreaterThan(0)
    expect(
      document.querySelector("[data-confirmation-reason]")?.textContent,
    ).toMatch(text)
  })

  it.each([
    ["outcome_unknown", /provider didn’t confirm whether it happened/],
    [
      "interrupted",
      /action was interrupted and it isn’t known whether it happened/,
    ],
  ])("tells an unknown outcome apart: %s", (reason, text) => {
    show("en", closed("unknown", reason))

    expect(
      screen.getAllByText("Outcome unknown: check before trying again").length,
    ).toBeGreaterThan(0)
    expect(
      document.querySelector("[data-confirmation-reason]")?.textContent,
    ).toMatch(text)
  })

  it("shows nothing extra for a reason this client does not know", () => {
    show("en", closed("invalidated", "some_future_reason"))

    expect(
      screen.getAllByText("Can no longer run: ask again").length,
    ).toBeGreaterThan(0)
    expect(document.querySelector("[data-confirmation-reason]")).toBeNull()
  })

  it("speaks the user's language", () => {
    show("es", closed("unknown", "interrupted"))

    expect(
      document.querySelector("[data-confirmation-reason]")?.textContent,
    ).toMatch(/La acción se interrumpió y no se sabe si llegó a ocurrir/)
  })

  it("does not add a reason to a plain failure", () => {
    show("en", closed("failed", "Provider error 500"))

    expect(document.querySelector("[data-confirmation-reason]")).toBeNull()
  })
})

describe("server field errors by code", () => {
  afterEach(cleanup)

  const refuse = (
    errors: { field: string; message: string; code?: string }[],
    actionId = "a-1",
  ) =>
    vi.fn(async () => {
      throw rejection(actionId, errors)
    })

  async function submitWith(locale: string, decide: ReturnType<typeof vi.fn>) {
    render(
      <ToolResultCard
        locale={locale}
        part={mailPart()}
        toolConfirmation={{ states: snapshot(state()), decide }}
      />,
    )
    click(locale === "es" ? "Editar" : "Edit")
    type(locale === "es" ? "Asunto" : "Subject", "Cambiado")
    click(locale === "es" ? "Guardar y enviar" : "Save and send")
    await waitFor(() => expect(decide).toHaveBeenCalled())
  }

  it("translates a code the client knows, in the user's language", async () => {
    await submitWith(
      "es",
      refuse([
        {
          field: "subject",
          code: "plain_text_only",
          message: "must be plain text, without HTML",
        },
      ]),
    )

    expect(
      await screen.findByText("Usa texto sin formato, sin HTML"),
    ).toBeTruthy()
    // Not the English message the server sent.
    expect(screen.queryByText("must be plain text, without HTML")).toBeNull()
  })

  it("falls back to the server's message for a code it does not know", async () => {
    await submitWith(
      "en",
      refuse([
        {
          field: "subject",
          code: "a_code_from_the_future",
          message: "the server says no",
        },
      ]),
    )

    expect(await screen.findByText("the server says no")).toBeTruthy()
  })

  it("still works against a server that sends no code", async () => {
    await submitWith(
      "en",
      refuse([{ field: "subject", message: "older server message" }]),
    )

    expect(await screen.findByText("older server message")).toBeTruthy()
  })

  it("names the zone in an ambiguous time sent back by the server", async () => {
    const decide = refuse(
      [{ field: "start", code: "ambiguous_time", message: "x" }],
      "e-1",
    )
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
    type("Starts", "2027-11-15T10:30")
    click("Save and confirm")

    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(screen.getByRole("alert").textContent).toContain("Europe/Madrid")
  })
})

describe("a submission the server already has", () => {
  afterEach(cleanup)

  const conflict = (
    code: "decision_in_progress" | "decision_request_conflict",
  ) =>
    new ToolSubmissionConflictError(
      { code, executionId: "run-1" },
      { type: "http_error", message: "HTTP 409", status: 409, code },
    )

  it("says it is already being applied, not that it failed, and lets the card follow the server", async () => {
    const decide = vi.fn(async () => {
      throw conflict("decision_in_progress")
    })
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{ states: snapshot(state()), decide }}
      />,
    )

    click("Send")

    expect(
      await screen.findByText("This is already being applied…"),
    ).toBeTruthy()
    expect(
      screen.queryByText("Your decision couldn’t be sent. Try again."),
    ).toBeNull()
    // Nothing to resend, but nothing is locked either: the server's state decides.
    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })

  it("clears the notice when the user decides again", async () => {
    let calls = 0
    const decide = vi.fn(async () => {
      calls += 1
      if (calls === 1) throw conflict("decision_in_progress")
    })
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{ states: snapshot(state()), decide }}
      />,
    )
    click("Send")
    await screen.findByText("This is already being applied…")

    click("Send")

    await waitFor(() =>
      expect(screen.queryByText("This is already being applied…")).toBeNull(),
    )
  })

  it("treats a key conflict as a failure to send", async () => {
    const decide = vi.fn(async () => {
      throw conflict("decision_request_conflict")
    })
    render(
      <ToolResultCard
        locale="en"
        part={mailPart()}
        toolConfirmation={{ states: snapshot(state()), decide }}
      />,
    )

    click("Send")

    expect(
      await screen.findByText("Your decision couldn’t be sent. Try again."),
    ).toBeTruthy()
  })
})
