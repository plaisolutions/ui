import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ToolResultCard } from "../components"

describe("ToolResultWorkflowDispatchCard", () => {
  it("opens a sheet with the dispatched workflow details", () => {
    const view = render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_workflow_1",
          name: "dispatch_monthly_report",
          toolType: "workflow_dispatch",
          input: { month: "2026-07" },
          state: "completed",
          result: JSON.stringify({
            execution_id: "execution_123",
            workflow_id: "workflow_456",
            workflow_name_slug: "monthly-report",
            status: "DISPATCHED",
          }),
          metadata: { type: "workflow_dispatch" },
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Workflow: monthly-report" }),
    )

    const sheet = screen.getByRole("dialog", { name: "Workflow dispatch" })
    expect(within(sheet).getByText("DISPATCHED")).toBeTruthy()
    expect(within(sheet).getByText("execution_123")).toBeTruthy()
    expect(within(sheet).getByText("workflow_456")).toBeTruthy()
    view.unmount()
  })

  it("shows structured error details", () => {
    const view = render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_workflow_error",
          name: "dispatch_monthly_report",
          toolType: "workflow_dispatch",
          input: {},
          state: "error",
          errorDetails: { message: "Workflow is disabled" },
          metadata: { type: "workflow_dispatch" },
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", {
        name: "Workflow: dispatch_monthly_report",
      }),
    )

    expect(screen.getByText(/Workflow is disabled/)).toBeTruthy()
    view.unmount()
  })
})
