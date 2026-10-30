import type {
  ConfirmedAction,
  PendingConfirmation,
  ToolConfirmationItem,
  ToolConfirmationStatus,
  ToolConfirmationsResponse,
  UIMessage,
} from "./types"

/**
 * What a card knows about one action. `source` tells where it came from: the
 * stream of this tab or the server's tool_confirmations endpoint. Either way
 * it is server state; the card adds its own "Confirming…" while it sends.
 */
export type ToolConfirmationState = {
  actionId: string
  toolName: string | null
  status: ToolConfirmationStatus | "not_found"
  /** -1 when unknown (e.g. not_found): any real version replaces it. */
  stateVersion: number
  expiresAt: string | null
  canConfirm: boolean
  canReject: boolean
  error: string | null
  /** Metadata of the tool once it ran (links, connector...). */
  metadata: Record<string, unknown> | null
  pendingConfirmation: PendingConfirmation | null
  source: "stream" | "server"
}

export type ToolConfirmationSnapshot = {
  items: Readonly<Record<string, ToolConfirmationState>>
  /** server time minus local time when last read; to count down expiry. */
  serverOffsetMs: number
}

export type ToolConfirmationListener = (
  snapshot: ToolConfirmationSnapshot,
) => void

/** States that still change on their own (polling makes sense). */
export const OPEN_TOOL_CONFIRMATION_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "executing",
])

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** `pending_confirmation` of a tool part, if it is a held action. */
export function pendingConfirmationOf(
  metadata: unknown,
): PendingConfirmation | null {
  const pending = asRecord(asRecord(metadata)?.pending_confirmation)
  return pending &&
    typeof pending.action_id === "string" &&
    asRecord(pending.action)
    ? (pending as PendingConfirmation)
    : null
}

/** Ids of every held action shown in these messages, oldest first. */
export function pendingActionIds(messages: readonly UIMessage[]): string[] {
  const ids: string[] = []
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool-call") continue
      const pending = pendingConfirmationOf(part.metadata)
      if (pending && !ids.includes(pending.action_id)) {
        ids.push(pending.action_id)
      }
    }
  }
  return ids
}

/** The new state wins only if it is not older than what the card already shows. */
function isNewer(
  previous: ToolConfirmationState | undefined,
  next: ToolConfirmationState,
): boolean {
  if (!previous) return true
  if (next.stateVersion !== previous.stateVersion) {
    return next.stateVersion > previous.stateVersion
  }
  // Same version: the server endpoint is richer than a stream summary.
  if (next.source !== "server" && previous.source === "server") return false
  return !sameState(previous, next)
}

function sameState(a: ToolConfirmationState, b: ToolConfirmationState) {
  return (
    a.source === b.source &&
    a.status === b.status &&
    a.canConfirm === b.canConfirm &&
    a.canReject === b.canReject &&
    a.expiresAt === b.expiresAt &&
    a.error === b.error &&
    JSON.stringify(a.metadata) === JSON.stringify(b.metadata) &&
    JSON.stringify(a.pendingConfirmation) ===
      JSON.stringify(b.pendingConfirmation)
  )
}

/** Clock drift below this is noise: it does not change any countdown. */
const OFFSET_TOLERANCE_MS = 1000

/** State of `actionId` in a snapshot, with expiry projected from the server clock. */
export function toolConfirmationAt(
  snapshot: ToolConfirmationSnapshot,
  actionId: string,
  now = Date.now(),
): ToolConfirmationState | undefined {
  const item = snapshot.items[actionId]
  return item ? expiredLocally(item, now + snapshot.serverOffsetMs) : undefined
}

function expiredLocally(
  item: ToolConfirmationState,
  serverNow: number,
): ToolConfirmationState {
  if (
    item.status !== "pending" ||
    !item.expiresAt ||
    Date.parse(item.expiresAt) > serverNow
  ) {
    return item
  }
  return { ...item, status: "expired", canConfirm: false, canReject: false }
}

/**
 * Per-chat store of action states, keyed by action id. It only moves forward
 * (`state_version`), so a late HTTP answer never undoes a newer stream result.
 */
export class ToolConfirmationStore {
  private snapshot: ToolConfirmationSnapshot = { items: {}, serverOffsetMs: 0 }

  private readonly listeners = new Set<ToolConfirmationListener>()

  getSnapshot(): ToolConfirmationSnapshot {
    return this.snapshot
  }

  subscribe(listener: ToolConfirmationListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Current state with expiry projected from the server clock. */
  get(actionId: string, now = Date.now()): ToolConfirmationState | undefined {
    return toolConfirmationAt(this.snapshot, actionId, now)
  }

  /** Feed a tool_result from the stream: a new held action or decision outcomes. */
  applyToolResult(metadata: unknown): void {
    const record = asRecord(metadata)
    if (!record) return
    const updates: ToolConfirmationState[] = []
    const pending = pendingConfirmationOf(record)
    if (pending) {
      // Just prepared by the server in this stream: decidable until it expires.
      updates.push({
        actionId: pending.action_id,
        toolName: pending.tool_name,
        status: "pending",
        stateVersion: pending.state_version ?? 1,
        expiresAt: pending.expires_at ?? null,
        canConfirm: true,
        canReject: true,
        error: null,
        metadata: null,
        pendingConfirmation: pending,
        source: "stream",
      })
    }
    if (record.type === "tool_confirmation" && Array.isArray(record.actions)) {
      for (const action of record.actions as ConfirmedAction[]) {
        if (typeof asRecord(action)?.action_id !== "string") continue
        const previous = this.snapshot.items[action.action_id]
        const open = action.status === "pending"
        updates.push({
          actionId: action.action_id,
          toolName: action.tool_name ?? previous?.toolName ?? null,
          status: action.status,
          stateVersion:
            typeof action.state_version === "number"
              ? action.state_version
              : -1,
          expiresAt: previous?.expiresAt ?? null,
          canConfirm: open,
          canReject: open,
          error: action.error ?? null,
          metadata: asRecord(action.metadata),
          pendingConfirmation: previous?.pendingConfirmation ?? null,
          source: "stream",
        })
      }
    }
    this.merge(updates)
  }

  /** Feed the answer of the thread's tool_confirmations endpoint. */
  applyServer(response: ToolConfirmationsResponse, now = Date.now()): void {
    const serverTime = Date.parse(response.server_time)
    const measured = Number.isNaN(serverTime) ? 0 : serverTime - now
    const serverOffsetMs =
      Math.abs(measured - this.snapshot.serverOffsetMs) < OFFSET_TOLERANCE_MS
        ? this.snapshot.serverOffsetMs
        : measured
    this.merge(response.items.map(fromServerItem), serverOffsetMs)
  }

  clear(): void {
    this.setSnapshot({ items: {}, serverOffsetMs: 0 })
  }

  private merge(
    updates: ToolConfirmationState[],
    serverOffsetMs = this.snapshot.serverOffsetMs,
  ): void {
    let items: Record<string, ToolConfirmationState> | null = null
    for (const update of updates) {
      const current = (items ?? this.snapshot.items)[update.actionId]
      if (!isNewer(current, update)) continue
      items ??= { ...this.snapshot.items }
      items[update.actionId] = update
    }
    if (!items && serverOffsetMs === this.snapshot.serverOffsetMs) return
    this.setSnapshot({ items: items ?? this.snapshot.items, serverOffsetMs })
  }

  private setSnapshot(snapshot: ToolConfirmationSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}

function fromServerItem(item: ToolConfirmationItem): ToolConfirmationState {
  return {
    actionId: item.action_id,
    toolName: item.tool_name,
    status: item.status,
    stateVersion: item.state_version,
    expiresAt: item.expires_at,
    canConfirm: item.can_confirm,
    canReject: item.can_reject,
    error: item.error ?? null,
    metadata: item.metadata ?? null,
    pendingConfirmation: item.pending_confirmation ?? null,
    source: "server",
  }
}

/** The persisted message only carries the decisions; the UI hides it. */
export function isHiddenMessage(message: UIMessage): boolean {
  return asRecord(message.metadata?.metadata)?.hidden === true
}
