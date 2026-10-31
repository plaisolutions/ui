import {
  type PendingConfirmation,
  type ToolConfirmationSnapshot,
  type ToolConfirmationState,
  type ToolDecision,
  toolConfirmationAt,
} from "@plaisolutions/client"
import { CheckCircle2, Clock, LoaderCircle, XCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { joinClasses } from "./internal/join-classes"
import {
  type PersonalConnectorCopy,
  fillCopy,
} from "./internal/personal-connector-copy"

/**
 * Lets the user confirm or reject held actions from their cards. Built by the
 * host from its chat (`useChat`/registry), bound to the card's own thread.
 */
export type ToolConfirmationProps = {
  /** `useChat().toolConfirmations` or `useToolConfirmations(chat)`. */
  states: ToolConfirmationSnapshot
  /** Sends the decisions in a new invoke of the card's thread. */
  decide: (decisions: ToolDecision[]) => Promise<void>
  /** The thread is busy (a response is streaming): buttons are disabled. */
  disabled?: boolean
}

const MINUTE = 60_000

/** Re-renders every `intervalMs` while `active`, for countdowns. */
function useNow(active: boolean, intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [active, intervalMs])
  return now
}

/** Server state of a held action, with expiry kept current. */
export function useToolConfirmationState(
  pending: PendingConfirmation | null,
  toolConfirmation: ToolConfirmationProps | undefined,
): ToolConfirmationState | undefined {
  const item = pending
    ? toolConfirmation?.states.items[pending.action_id]
    : undefined
  const now = useNow(item?.status === "pending")
  return toolConfirmation && pending
    ? toolConfirmationAt(toolConfirmation.states, pending.action_id, now)
    : undefined
}

function verbFor(
  operation: PendingConfirmation["operation"],
  copy: PersonalConnectorCopy,
) {
  switch (operation) {
    case "send":
      return copy.confirmSend
    case "create":
      return copy.confirmCreate
    case "update":
      return copy.confirmUpdate
    case "delete":
      return copy.confirmDelete
    default:
      return copy.confirmGeneric
  }
}

const STATUS_COPY: Record<string, keyof PersonalConnectorCopy> = {
  executing: "statusExecuting",
  executed: "statusExecuted",
  rejected: "statusRejected",
  expired: "statusExpired",
  superseded: "statusSuperseded",
  invalidated: "statusInvalidated",
  failed: "statusFailed",
  unknown: "statusUnknown",
  not_found: "statusNotFound",
}

export function statusLabel(
  status: string,
  copy: PersonalConnectorCopy,
): string | null {
  const key = STATUS_COPY[status]
  return key ? copy[key] : null
}

const BADGE_TONE: Record<string, string> = {
  pending: "border-warning-border bg-warning-subtle text-warning-strong",
  executing: "border-sky-200 bg-sky-50 text-sky-800",
  executed: "border-success-border bg-success-subtle text-success-strong",
  failed: "border-danger-border bg-danger-subtle text-danger-strong",
  unknown: "border-warning-border bg-warning-subtle text-warning-strong",
}

/** Header badge of a held action: "Awaiting your confirmation" or its outcome. */
export function ConfirmationBadge({
  state,
  copy,
}: {
  state: ToolConfirmationState | undefined
  copy: PersonalConnectorCopy
}) {
  const status = state?.status ?? "pending"
  const label =
    status === "pending" ? copy.awaitingConfirmation : statusLabel(status, copy)
  const Icon =
    status === "executed"
      ? CheckCircle2
      : status === "failed"
        ? XCircle
        : status === "executing"
          ? LoaderCircle
          : Clock
  return (
    <span
      className={joinClasses(
        "ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
        BADGE_TONE[status] ?? "border-border bg-surface-muted text-strong",
      )}
      data-confirmation-status={status}
    >
      <Icon
        className={joinClasses(
          "h-3 w-3",
          status === "executing" ? "animate-spin" : undefined,
        )}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}

function expiryText(
  state: ToolConfirmationState,
  serverOffsetMs: number,
  now: number,
  copy: PersonalConnectorCopy,
) {
  if (!state.expiresAt) return null
  const left = Date.parse(state.expiresAt) - (now + serverOffsetMs)
  if (Number.isNaN(left) || left <= 0) return null
  return left < MINUTE
    ? copy.expiresSoon
    : fillCopy(copy.expiresIn, { minutes: Math.floor(left / MINUTE) })
}

/**
 * Footer of a held action. Without `toolConfirmation` it keeps the text hint
 * (reply "yes"); with it, buttons once the server state is known.
 */
export function PendingConfirmationFooter({
  pending,
  toolConfirmation,
  copy,
}: {
  pending: PendingConfirmation
  toolConfirmation?: ToolConfirmationProps
  copy: PersonalConnectorCopy
}) {
  const state = useToolConfirmationState(pending, toolConfirmation)
  const now = useNow(state?.status === "pending")
  const [sending, setSending] = useState<ToolDecision["decision"] | null>(null)
  const [failed, setFailed] = useState(false)

  if (!toolConfirmation) {
    return (
      <p className="border-t border-border bg-warning-subtle/60 px-3 py-2 text-xs text-strong">
        {copy.confirmHint}
      </p>
    )
  }

  if (!state) {
    // Unknown until the server answers: no decision on an unverified state.
    return (
      <p
        className="border-t border-divider bg-surface-muted px-3 py-2 text-xs text-muted"
        aria-live="polite"
      >
        {copy.verifying}
      </p>
    )
  }

  if (state.status !== "pending") {
    const label = statusLabel(state.status, copy)
    return label ? (
      <p
        className="border-t border-divider bg-surface-muted px-3 py-2 text-xs text-strong"
        aria-live="polite"
      >
        {label}
        {state.status === "failed" && state.error ? `: ${state.error}` : null}
      </p>
    ) : null
  }

  const decide = async (decision: ToolDecision["decision"]) => {
    setSending(decision)
    setFailed(false)
    try {
      await toolConfirmation.decide([
        { action_id: pending.action_id, decision },
      ])
    } catch {
      setFailed(true)
    } finally {
      setSending(null)
    }
  }

  const disabled = Boolean(toolConfirmation.disabled) || sending !== null
  const destructive = pending.operation === "delete"
  const expiry = expiryText(
    state,
    toolConfirmation.states.serverOffsetMs,
    now,
    copy,
  )
  const unavailable = state.error === "tool_unavailable"

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-t border-border bg-warning-subtle/60 px-3 py-2"
      data-confirmation-actions={pending.action_id}
    >
      {state.canConfirm ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void decide("confirm")}
          className={joinClasses(
            "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-inverse-foreground disabled:opacity-50",
            destructive
              ? "bg-danger hover:bg-danger-strong"
              : "bg-inverse hover:bg-inverse-hover",
          )}
        >
          {sending === "confirm" ? (
            <LoaderCircle
              className="mr-2 size-3 animate-spin"
              aria-hidden="true"
            />
          ) : null}
          {sending === "confirm"
            ? copy.confirming
            : verbFor(pending.operation, copy)}
        </button>
      ) : null}
      {state.canReject ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void decide("reject")}
          className="inline-flex items-center rounded-md border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-strong hover:bg-surface-muted disabled:opacity-50"
        >
          {sending === "reject" ? (
            <LoaderCircle
              className="mr-2 size-3 animate-spin"
              aria-hidden="true"
            />
          ) : null}
          {sending === "reject" ? copy.cancelling : copy.cancel}
        </button>
      ) : null}
      <span className="ml-auto text-xs text-secondary" aria-live="polite">
        {failed
          ? copy.decisionError
          : unavailable
            ? copy.toolUnavailable
            : expiry}
      </span>
    </div>
  )
}
