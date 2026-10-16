import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { ChatError } from "../components"

describe("ChatError", () => {
  afterEach(cleanup)
  it("renders a localized spending cap and UTC renewal", () => {
    render(
      <ChatError
        locale="es-ES"
        error={{
          type: "http_error",
          status: 403,
          code: "spending_cap_exceeded",
          message: "raw backend detail",
          periodEnd: "2026-11-01T00:00:00Z",
        }}
      />,
    )
    expect(screen.getByRole("alert").textContent).toContain(
      "Límite de gasto mensual alcanzado",
    )
    expect(screen.getByRole("alert").textContent).toContain("UTC")
    expect(screen.queryByText("raw backend detail")).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
  })
  it("shows rate limit guidance and the server delay", () => {
    render(
      <ChatError
        locale="en"
        error={{
          type: "http_error",
          status: 429,
          message: "HTTP 429",
          retryAfterSeconds: 30,
        }}
      />,
    )
    expect(screen.getByRole("alert").textContent).toContain("Too many requests")
    expect(screen.getByRole("alert").textContent).toContain("30 seconds")
  })
  it.each([
    "spending_cap_accounting_incomplete",
    "spending_cap_state_unavailable",
  ])("explains %s", (code) => {
    render(
      <ChatError
        locale="en"
        error={{ type: "http_error", code, message: "raw" }}
      />,
    )
    expect(screen.getByRole("alert").textContent).toContain("cannot verify")
  })
  it("does not classify ordinary permission errors as spending caps or expose raw bodies", () => {
    render(
      <ChatError
        locale="en"
        error={{
          type: "http_error",
          status: 403,
          message: "<html>private upstream details</html>",
        }}
      />,
    )
    expect(screen.getByRole("alert").textContent).toContain(
      "Something went wrong",
    )
    expect(screen.getByRole("alert").textContent).not.toContain(
      "private upstream",
    )
  })
  it("supports custom content and ignores malformed renewal dates", () => {
    render(
      <ChatError
        title="Custom title"
        locale="en"
        error={{
          type: "http_error",
          code: "spending_cap_exceeded",
          periodEnd: "bad",
          message: "blocked",
        }}
      >
        <a href="/help">Contact support</a>
      </ChatError>,
    )
    expect(screen.getByText("Custom title")).toBeTruthy()
    expect(screen.getByRole("link").textContent).toBe("Contact support")
  })
  it.each([null, { type: "abort_error" as const, message: "Cancelled" }])(
    "does not show normal cancellation or no error",
    (error) => {
      render(<ChatError error={error} />)
      expect(screen.queryByRole("alert")).toBeNull()
    },
  )
  it.each([
    "en",
    "es",
    "ca",
    "fr",
    "it",
    "de",
    "da",
    "sv",
    "nb-NO",
    "pt",
    "unsupported",
  ])("supports locale %s", (locale) => {
    render(
      <ChatError
        locale={locale}
        error={{ type: "network_error", message: "offline" }}
      />,
    )
    expect(screen.getByRole("alert").textContent?.length).toBeGreaterThan(20)
  })
})
