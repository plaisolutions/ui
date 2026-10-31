import {
  HttpStatusError,
  type MemoryProposal,
  type MemoryProposalActions,
} from "@plaisolutions/client"
import { MemoryProposalCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const AGENT_ID = "agent_story"

const baseProposal: MemoryProposal = {
  id: "mp_story",
  tool_call_id: "tool_memory_story",
  agent_id: AGENT_ID,
  project_id: "project_story",
  scope: "USER",
  category: "PREFERENCE",
  operation: "CREATE",
  content: "Prefiere respuestas breves, en español y con ejemplos de código.",
  previous_content: null,
  target_memory_id: null,
  target_memory_version: null,
  rationale: "El usuario lo ha pedido explícitamente varias veces.",
  status: "PENDING",
  can_resolve: true,
  requires_admin_review: false,
  created_at: "2026-10-31T10:00:00.000Z",
  expires_at: "2026-11-07T10:00:00.000Z",
  resolved_at: null,
}

function proposal(overrides: Partial<MemoryProposal> = {}): MemoryProposal {
  return { ...baseProposal, ...overrides }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Simulates the backend: resolves after a short delay with the new status.
function createActions(current: MemoryProposal): MemoryProposalActions {
  return {
    getMemoryProposal: async () => current,
    acceptMemoryProposal: async () => {
      await wait(800)
      return {
        ...current,
        status: "ACCEPTED",
        resolved_at: new Date().toISOString(),
      }
    },
    rejectMemoryProposal: async () => {
      await wait(800)
      return {
        ...current,
        status: "REJECTED",
        resolved_at: new Date().toISOString(),
      }
    },
  }
}

// Simulates a failed resolution followed by a refresh returning `latest`.
function createFailingActions(
  status: number,
  latest: MemoryProposal,
): MemoryProposalActions {
  const fail = async (): Promise<MemoryProposal> => {
    await wait(800)
    throw new HttpStatusError(status, "Error", "")
  }
  return {
    getMemoryProposal: async () => latest,
    acceptMemoryProposal: fail,
    rejectMemoryProposal: fail,
  }
}

const meta: Meta<typeof MemoryProposalCard> = {
  title: "Components/MemoryProposalCard",
  component: MemoryProposalCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    locale: "es",
    activeAgentId: AGENT_ID,
    proposal: baseProposal,
    actions: createActions(baseProposal),
  },
}

export default meta

type Story = StoryObj<typeof MemoryProposalCard>

export const PendingCreate: Story = {}

export const PendingUpdate: Story = {
  args: (() => {
    const p = proposal({
      operation: "UPDATE",
      category: "TOOL_GUIDANCE",
      previous_content: "Usa siempre Gmail para enviar correos.",
      content:
        "Usa Outlook para correos de trabajo y Gmail para correos personales.",
      target_memory_id: "mem_1",
      target_memory_version: 2,
    })
    return { proposal: p, actions: createActions(p) }
  })(),
}

export const PendingDelete: Story = {
  args: (() => {
    const p = proposal({
      operation: "DELETE",
      category: "PROFILE",
      content: null,
      previous_content: "Trabaja en el equipo de ventas de Barcelona.",
      target_memory_id: "mem_2",
      target_memory_version: 1,
    })
    return { proposal: p, actions: createActions(p) }
  })(),
}

export const ProjectPendingAdminReview: Story = {
  args: (() => {
    const p = proposal({
      scope: "PROJECT",
      category: "INSTRUCTION",
      content:
        "Los presupuestos deben incluir siempre el IVA desglosado por línea.",
      can_resolve: false,
      requires_admin_review: true,
    })
    return { proposal: p, actions: createActions(p) }
  })(),
}

export const UnavailableForOtherAgent: Story = {
  args: (() => {
    const p = proposal({ agent_id: "another_agent" })
    return { proposal: p, actions: createActions(p) }
  })(),
}

export const Accepted: Story = {
  args: (() => {
    const p = proposal({
      status: "ACCEPTED",
      resolved_at: "2026-10-31T10:05:00.000Z",
    })
    return { proposal: p, actions: createActions(p) }
  })(),
}

export const Rejected: Story = {
  args: (() => {
    const p = proposal({
      status: "REJECTED",
      resolved_at: "2026-10-31T10:05:00.000Z",
    })
    return { proposal: p, actions: createActions(p) }
  })(),
}

export const Expired: Story = {
  args: (() => {
    const p = proposal({ status: "EXPIRED" })
    return { proposal: p, actions: createActions(p) }
  })(),
}

export const Conflicted: Story = {
  args: (() => {
    const p = proposal({
      operation: "UPDATE",
      previous_content: "Prefiere respuestas largas y detalladas.",
      status: "CONFLICTED",
    })
    return { proposal: p, actions: createActions(p) }
  })(),
}

export const RedactedContent: Story = {
  args: (() => {
    const p = proposal({
      status: "ACCEPTED",
      content: "[redacted]",
      rationale: "[redacted]",
    })
    return { proposal: p, actions: createActions(p) }
  })(),
}

export const ConflictErrorOnResolve: Story = {
  args: {
    proposal: baseProposal,
    actions: createFailingActions(409, proposal({ status: "CONFLICTED" })),
  },
}

export const PermissionErrorOnResolve: Story = {
  args: {
    proposal: baseProposal,
    actions: createFailingActions(403, proposal({ can_resolve: false })),
  },
}

export const English: Story = {
  args: (() => {
    const p = proposal({
      category: "CORRECTION",
      content: "The user's company name is spelled “PlaiSolutions”.",
    })
    return { locale: "en", proposal: p, actions: createActions(p) }
  })(),
}
