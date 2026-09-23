import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import {
  HttpStatusError,
  type MemoryProposal,
  type MemoryProposalActions,
} from "@plaisolutions/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryProposalCard, ToolResultCard } from "../components"

const proposal: MemoryProposal = {
  id: "proposal-1",
  tool_call_id: "tool-1",
  agent_id: "agent-1",
  scope: "USER",
  category: "PREFERENCE",
  operation: "UPDATE",
  content: "Prefer concise answers",
  previous_content: "Prefer detailed answers",
  target_memory_id: "memory-1",
  target_memory_version: 1,
  status: "PENDING",
  can_resolve: true,
  created_at: "2026-09-23T10:00:00Z",
  expires_at: "2026-10-23T10:00:00Z",
}

describe("MemoryProposalCard", () => {
  afterEach(cleanup)

  it("shows authorized previous content and resolves acceptance", async () => {
    const acceptMemoryProposal = vi
      .fn()
      .mockResolvedValue({
        ...proposal,
        content: "[redacted]",
        previous_content: "[redacted]",
        status: "ACCEPTED",
      })
    const actions = {
      acceptMemoryProposal,
      rejectMemoryProposal: vi.fn(),
      getMemoryProposal: vi.fn(),
    } as MemoryProposalActions
    render(
      <MemoryProposalCard
        proposal={proposal}
        actions={actions}
        activeAgentId="agent-1"
        locale="es"
      />,
    )
    expect(screen.getByText("Prefer detailed answers")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Aceptar" }))
    await waitFor(() => expect(screen.getByText("Aceptada")).toBeTruthy())
    expect(screen.getByText("Prefer concise answers")).toBeTruthy()
  })

  it("does not render through ToolResultCard without explicit proposal actions", () => {
    const view = render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool-1",
          name: "propose_memory_change",
          toolType: "memory_proposal",
          input: {},
          state: "completed",
          metadata: { type: "memory_proposal", proposal },
        }}
      />,
    )
    expect(view.container.innerHTML).toBe("")
  })

  it("shows project proposals waiting for administrative review", () => {
    const actions = {} as MemoryProposalActions
    render(
      <MemoryProposalCard
        proposal={{
          ...proposal,
          scope: "PROJECT",
          category: "CORRECTION",
          can_resolve: false,
        }}
        actions={actions}
        activeAgentId="agent-1"
        locale="en"
      />,
    )

    expect(screen.getByText("Sent for admin review")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull()
  })

  it.each([
    ["REJECTED", "Rejected"],
    ["EXPIRED", "Expired"],
    ["CONFLICTED", "Could not be applied because the memory changed"],
  ] as const)("renders the %s final state", (status, label) => {
    render(
      <MemoryProposalCard
        proposal={{ ...proposal, status }}
        actions={{} as MemoryProposalActions}
        activeAgentId="agent-1"
        locale="en"
      />,
    )

    expect(screen.getByText(label)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull()
  })

  it.each([
    [
      409,
      "The memory changed. The latest status has been loaded.",
      "CONFLICTED",
    ],
    [410, "This proposal is no longer available.", "EXPIRED"],
  ] as const)(
    "refreshes the proposal after a %s resolution error",
    async (status, message, latestStatus) => {
      const actions = {
        acceptMemoryProposal: vi
          .fn()
          .mockRejectedValue(new HttpStatusError(status, "Error", "")),
        rejectMemoryProposal: vi.fn(),
        getMemoryProposal: vi.fn().mockResolvedValue({
          ...proposal,
          status: latestStatus,
        }),
      } as MemoryProposalActions
      render(
        <MemoryProposalCard
          proposal={proposal}
          actions={actions}
          activeAgentId="agent-1"
          locale="en"
        />,
      )

      fireEvent.click(screen.getByRole("button", { name: "Accept" }))

      await waitFor(() => expect(screen.getByText(message)).toBeTruthy())
      expect(actions.getMemoryProposal).toHaveBeenCalledWith({
        proposalId: "proposal-1",
      })
    },
  )
})
