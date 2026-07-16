import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ToolResultCard } from "../components"

describe("ToolResultAgentInvocationCard", () => {
  it("shows the invocation details and delegates opening the sub-thread", () => {
    const onOpenAgentThread = vi.fn()
    const view = render(
      <ToolResultCard
        onOpenAgentThread={onOpenAgentThread}
        part={{
          type: "tool-call",
          id: "tool_agent_1",
          name: "invoke_research_agent",
          toolType: "agent_invocation",
          input: { input: "Summarize the feedback." },
          state: "completed",
          result: "The main request is faster exports.",
          metadata: {
            type: "agent_invocation",
            agent_name: "Research agent",
            tracked_execution_id: "execution_123",
            thread_id: "thread_456",
          },
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Agent: Research agent" }),
    )

    const sheet = screen.getByRole("dialog", { name: "Research agent" })
    expect(within(sheet).getByText("execution_123")).toBeTruthy()
    expect(within(sheet).getByText("Summarize the feedback.")).toBeTruthy()
    expect(
      within(sheet).getByText("The main request is faster exports."),
    ).toBeTruthy()

    fireEvent.click(
      within(sheet).getByRole("button", { name: "Open conversation" }),
    )
    expect(onOpenAgentThread).toHaveBeenCalledWith("thread_456")
    view.unmount()
  })

  it("uses the tool name when metadata has no agent name", () => {
    const view = render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_agent_error",
          name: "invoke_support_agent",
          toolType: "agent_invocation",
          input: {},
          state: "error",
          errorDetails: { message: "Agent is unavailable" },
          metadata: { type: "agent_invocation" },
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Agent: support agent" }),
    )

    expect(screen.getByText(/Agent is unavailable/)).toBeTruthy()
    view.unmount()
  })
})
