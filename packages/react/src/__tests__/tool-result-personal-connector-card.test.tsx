import type { UIToolCallPart } from "@plaisolutions/client"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ToolResultCard, getToolUseLabel } from "../components"

const gmail = {
  provider: "google",
  capability: "gmail",
  label: "Gmail",
  account_email: "me@gmail.com",
}

function connectorPart(
  name: string,
  metadata: Record<string, unknown>,
  input: unknown = {},
): UIToolCallPart {
  return {
    type: "tool-call",
    id: `tool_${name}`,
    name,
    toolType: "personal_connector",
    input,
    state: "completed",
    result: "[]",
    metadata: { type: "personal_connector", ...metadata },
  }
}

function mail(index: number, extra: Record<string, unknown> = {}) {
  return {
    id: `m-${index}`,
    from: `Ana Pérez <ana${index}@acme.com>`,
    subject: `Budget ${index}`,
    snippet: `Snippet ${index}`,
    date: "2026-01-15T09:30:00+01:00",
    unread: false,
    link: `https://mail.google.com/mail/#all/m-${index}`,
    ...extra,
  }
}

describe("ToolResultPersonalConnectorCard", () => {
  it("lists found emails with sender, subject and a link to each", () => {
    render(
      <ToolResultCard
        locale="en"
        part={connectorPart("gmail_search", {
          connector: gmail,
          action: "search",
          result: [mail(1, { unread: true }), mail(2)],
        })}
      />,
    )

    expect(screen.getByText("Gmail")).toBeTruthy()
    expect(screen.getByText("· me@gmail.com")).toBeTruthy()
    expect(screen.getByText("2 emails")).toBeTruthy()
    expect(screen.getAllByText("Ana Pérez")).toHaveLength(2)
    expect(screen.getByLabelText("Unread")).toBeTruthy()
    const link = screen.getByText("Budget 1").closest("a")
    expect(link?.getAttribute("href")).toBe(
      "https://mail.google.com/mail/#all/m-1",
    )
    expect(link?.getAttribute("target")).toBe("_blank")
  })

  it("collapses long result lists behind a show-all toggle", () => {
    render(
      <ToolResultCard
        locale="es"
        part={connectorPart("gmail_search", {
          connector: gmail,
          action: "search",
          result: Array.from({ length: 7 }, (_, index) => mail(index)),
        })}
      />,
    )

    expect(screen.queryByText("Budget 6")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Ver todos (7)" }))
    expect(screen.getByText("Budget 6")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ver menos" })).toBeTruthy()
  })

  it("shows a read email with its body and an open link", () => {
    render(
      <ToolResultCard
        locale="en"
        part={connectorPart("gmail_read", {
          connector: gmail,
          action: "read",
          result: {
            ...mail(1),
            to: "me@gmail.com",
            body: "Hi,\nthe budget is attached.",
          },
        })}
      />,
    )

    expect(screen.getByRole("heading", { name: "Budget 1" })).toBeTruthy()
    expect(screen.getByText("To: me@gmail.com")).toBeTruthy()
    expect(screen.getByText(/the budget is attached/)).toBeTruthy()
    expect(
      screen.getByRole("link", { name: /Open in Gmail/ }).getAttribute("href"),
    ).toBe("https://mail.google.com/mail/#all/m-1")
  })

  it("groups calendar events by day with their time range", () => {
    render(
      <ToolResultCard
        locale="en"
        part={connectorPart("google_calendar_list_events", {
          connector: {
            ...gmail,
            capability: "google_calendar",
            label: "Google Calendar",
          },
          action: "list_events",
          result: [
            {
              id: "e-1",
              title: "Standup",
              start: "2026-01-15T09:00:00",
              end: "2026-01-15T09:15:00",
              attendees: ["a@acme.com", "b@acme.com"],
              link: "https://calendar.google.com/event?eid=1",
            },
            { id: "e-2", title: "Offsite", start: "2026-01-16", all_day: true },
          ],
        })}
      />,
    )

    expect(screen.getByText("2 events")).toBeTruthy()
    expect(screen.getByText("Thursday, January 15")).toBeTruthy()
    expect(screen.getByText("Friday, January 16")).toBeTruthy()
    expect(screen.getByText("All day")).toBeTruthy()
    expect(screen.getByText("2 attendees")).toBeTruthy()
    expect(screen.getByText("Standup").closest("a")?.getAttribute("href")).toBe(
      "https://calendar.google.com/event?eid=1",
    )
  })

  it("confirms a saved draft with a link to it", () => {
    render(
      <ToolResultCard
        locale="en"
        part={connectorPart(
          "gmail_create_draft",
          {
            connector: gmail,
            action: "create_draft",
            result: {
              draft_id: "d-1",
              link: "https://mail.google.com/mail/#drafts",
            },
          },
          { to: ["ana@acme.com"], subject: "Proposal", body: "..." },
        )}
      />,
    )

    expect(screen.getByText("Draft saved")).toBeTruthy()
    expect(screen.getByText("Proposal")).toBeTruthy()
    expect(screen.getByText("To: ana@acme.com")).toBeTruthy()
    expect(screen.getByRole("link", { name: /Open draft/ })).toBeTruthy()
  })

  it("falls back to the generic card for actions without a view", () => {
    render(
      <ToolResultCard
        locale="en"
        part={connectorPart("gmail_send", {
          pending_confirmation: { action_id: "a-1" },
        })}
      />,
    )

    expect(screen.getByRole("heading", { name: "gmail_send" })).toBeTruthy()
  })
})

describe("personal connector tool use labels", () => {
  it("names the service and the action instead of the tool", () => {
    const label = (name: string, locale = "en") =>
      getToolUseLabel({ name, toolType: "personal_connector" }, locale)

    expect(label("gmail_search")).toBe("Searching Gmail")
    expect(label("outlook_calendar_list_events_2")).toBe(
      "Checking Outlook Calendar",
    )
    expect(label("gmail_create_draft", "es")).toBe(
      "Guardando un borrador en Gmail",
    )
    expect(label("gmail_unknown_action")).toBe("Running gmail_unknown_action")
    expect(
      getToolUseLabel(
        { name: "confirm_pending_actions", toolType: "tool_confirmation" },
        "en",
      ),
    ).toBe("Running the confirmed actions")
  })
})
