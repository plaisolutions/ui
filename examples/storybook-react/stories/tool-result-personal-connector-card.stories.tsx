import type { UIPersonalConnectorToolCallPart } from "@plaisolutions/client"
import { ToolResultPersonalConnectorCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ToolResultPersonalConnectorCard> = {
  title: "Components/ToolResultPersonalConnectorCard",
  component: ToolResultPersonalConnectorCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div>
        <Story />
      </div>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof ToolResultPersonalConnectorCard>

const gmail = {
  provider: "google",
  capability: "gmail",
  label: "Gmail",
  account_email: "dani@plai.ai",
}

function part(
  name: string,
  metadata: UIPersonalConnectorToolCallPart["metadata"],
  input: unknown = {},
): UIPersonalConnectorToolCallPart {
  return {
    type: "tool-call",
    id: `tool_${name}`,
    name,
    toolType: "personal_connector",
    input,
    state: "completed",
    metadata: { type: "personal_connector", ...metadata },
  }
}

const today = new Date()
const at = (hours: number, minutes = 0, dayOffset = 0) => {
  const date = new Date(today)
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

export const SearchMail: Story = {
  args: {
    locale: "es",
    part: part(
      "gmail_search",
      {
        connector: gmail,
        action: "search",
        result: [
          {
            id: "m-1",
            from: "Ana Pérez <ana@acme.com>",
            subject: "Presupuesto Q4 revisado",
            snippet:
              "Hola Dani, te adjunto la versión revisada con los cambios que comentamos…",
            date: at(9, 42),
            unread: true,
            link: "https://mail.google.com/mail/#all/m-1",
          },
          {
            id: "m-2",
            from: "Jira <jira@acme.atlassian.net>",
            subject: "[PLAI-1234] Conectores personales: revisión de UX",
            snippet: "Marta ha comentado en la incidencia…",
            date: at(8, 15),
            unread: true,
            link: "https://mail.google.com/mail/#all/m-2",
          },
          {
            id: "m-3",
            from: "Carlos Ruiz <carlos@cliente.com>",
            subject: "Re: Demo del jueves",
            snippet: "Perfecto, nos vemos el jueves a las 10.",
            date: at(18, 5, -1),
            link: "https://mail.google.com/mail/#all/m-3",
          },
        ],
      },
      { query: "is:unread newer_than:2d" },
    ),
  },
}

export const ReadMail: Story = {
  args: {
    locale: "es",
    part: part("gmail_read", {
      connector: gmail,
      action: "read",
      result: {
        id: "m-1",
        from: "Ana Pérez <ana@acme.com>",
        to: "dani@plai.ai",
        cc: "finanzas@acme.com",
        subject: "Presupuesto Q4 revisado",
        date: at(9, 42),
        body:
          "Hola Dani,\n\nTe adjunto la versión revisada del presupuesto del Q4 con los cambios que comentamos en la reunión del lunes. " +
          "He ajustado las partidas de infraestructura y he movido la formación al Q1.\n\n".repeat(
            3,
          ) +
          "Un saludo,\nAna",
        link: "https://mail.google.com/mail/#all/m-1",
      },
    }),
  },
}

export const ListEvents: Story = {
  args: {
    locale: "es",
    part: part("google_calendar_list_events", {
      connector: {
        ...gmail,
        capability: "google_calendar",
        label: "Google Calendar",
      },
      action: "list_events",
      result: [
        {
          id: "e-1",
          title: "Daily",
          start: at(9),
          end: at(9, 15),
          attendees: ["a@plai.ai", "b@plai.ai", "c@plai.ai"],
          link: "https://calendar.google.com/",
          online_meeting_url: "https://meet.google.com/abc-defg-hij",
        },
        {
          id: "e-2",
          title: "Demo con Cliente",
          start: at(10, 0, 1),
          end: at(11, 0, 1),
          location: "Oficina Barcelona",
          attendees: ["carlos@cliente.com"],
          link: "https://calendar.google.com/",
        },
        { id: "e-3", title: "Offsite", start: "2026-12-18", all_day: true },
      ],
    }),
  },
}

export const DraftSaved: Story = {
  args: {
    locale: "es",
    part: part(
      "gmail_create_draft",
      {
        connector: gmail,
        action: "create_draft",
        result: {
          draft_id: "d-1",
          link: "https://mail.google.com/mail/#drafts",
        },
      },
      {
        to: ["carlos@cliente.com"],
        subject: "Propuesta de colaboración",
        body: "…",
      },
    ),
  },
}

export const PendingSend: Story = {
  args: {
    locale: "es",
    part: part("gmail_send", {
      connector: gmail,
      action: "send",
      pending_confirmation: {
        action_id: "a-1",
        tool_name: "gmail_send",
        action: {
          operation: "send",
          to: ["carlos@cliente.com"],
          cc: ["ana@plai.ai"],
          subject: "Propuesta de colaboración",
          body: "Hola Carlos,\n\nComo hablamos ayer, te envío la propuesta con el alcance y el calendario.\n\nUn saludo,\nDani",
        },
      },
    }),
  },
}

export const PendingEventUpdate: Story = {
  args: {
    locale: "es",
    part: part("google_calendar_update_event", {
      connector: {
        ...gmail,
        capability: "google_calendar",
        label: "Google Calendar",
      },
      action: "update_event",
      pending_confirmation: {
        action_id: "a-2",
        tool_name: "google_calendar_update_event",
        kind: "calendar",
        operation: "update",
        editable: [],
        action: {
          operation: "update_event",
          event_id: "e-2",
          start: at(12, 0, 1),
          end: at(13, 0, 1),
          location: "Google Meet",
        },
        current: {
          id: "e-2",
          title: "Demo con Cliente",
          start: at(10, 0, 1),
          end: at(11, 0, 1),
          location: "Oficina Barcelona",
          attendees: ["carlos@cliente.com"],
        },
      },
    }),
  },
}

export const PendingEventDelete: Story = {
  args: {
    locale: "es",
    part: part("google_calendar_delete_event", {
      connector: {
        ...gmail,
        capability: "google_calendar",
        label: "Google Calendar",
      },
      action: "delete_event",
      pending_confirmation: {
        action_id: "a-3",
        tool_name: "google_calendar_delete_event",
        kind: "calendar",
        operation: "delete",
        editable: [],
        action: { operation: "delete_event", event_id: "e-2" },
        current: {
          id: "e-2",
          title: "Demo con Cliente",
          start: at(10, 0, 1),
          end: at(11, 0, 1),
          attendees: ["carlos@cliente.com"],
        },
      },
    }),
  },
}

const inHalfAnHour = new Date(Date.now() + 30 * 60_000).toISOString()

const pendingSendPart = part("gmail_send", {
  connector: gmail,
  action: "send",
  pending_confirmation: {
    action_id: "a-1",
    tool_name: "gmail_send",
    kind: "mail",
    operation: "send",
    editable: [],
    expires_at: inHalfAnHour,
    state_version: 1,
    action: {
      operation: "send",
      to: ["carlos@cliente.com"],
      subject: "Propuesta",
      body: "Hola Carlos,\n\nTe adjunto la propuesta revisada.\n\nUn saludo",
    },
  },
})

function confirmationState(
  status: "pending" | "executed" | "rejected" | "expired",
  actionId = "a-1",
  toolName = "gmail_send",
) {
  const open = status === "pending"
  return {
    items: {
      [actionId]: {
        actionId,
        toolName,
        status,
        stateVersion: open ? 1 : 3,
        expiresAt: inHalfAnHour,
        canConfirm: open,
        canReject: open,
        error: null,
        metadata: null,
        pendingConfirmation: null,
        source: "server" as const,
      },
    },
    serverOffsetMs: 0,
  }
}

/** With `toolConfirmation`: Send / Cancel buttons and a server-based countdown. */
export const PendingSendWithButtons: Story = {
  args: {
    locale: "es",
    part: pendingSendPart,
    toolConfirmation: {
      states: confirmationState("pending"),
      decide: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1500))
      },
    },
  },
}

/** State not verified yet: no decision until the server answers. */
export const PendingSendVerifying: Story = {
  args: {
    locale: "es",
    part: pendingSendPart,
    toolConfirmation: {
      states: { items: {}, serverOffsetMs: 0 },
      decide: async () => {},
    },
  },
}

export const PendingSendSent: Story = {
  args: {
    locale: "es",
    part: pendingSendPart,
    toolConfirmation: {
      states: confirmationState("executed"),
      decide: async () => {},
    },
  },
}

export const PendingSendCancelled: Story = {
  args: {
    locale: "es",
    part: pendingSendPart,
    toolConfirmation: {
      states: confirmationState("rejected"),
      decide: async () => {},
    },
  },
}

/** Event update with `toolConfirmation`: "Guardar cambios" / "Cancelar". */
export const PendingEventUpdateWithButtons: Story = {
  args: {
    ...PendingEventUpdate.args,
    toolConfirmation: {
      states: confirmationState(
        "pending",
        "a-2",
        "google_calendar_update_event",
      ),
      decide: async () => {},
    },
  },
}

/** Event delete with `toolConfirmation`: destructive "Eliminar" / "Cancelar". */
export const PendingEventDeleteWithButtons: Story = {
  args: {
    ...PendingEventDelete.args,
    toolConfirmation: {
      states: confirmationState(
        "pending",
        "a-3",
        "google_calendar_delete_event",
      ),
      decide: async () => {},
    },
  },
}
