import {
  OPEN_TOOL_CONFIRMATION_STATUSES,
  type PlaiChat,
  type ToolConfirmationSnapshot,
  pendingActionIds,
} from "@plaisolutions/client"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

/** State of the chat's actions awaiting confirmation, for the cards. */
export function useToolConfirmations(chat: PlaiChat): ToolConfirmationSnapshot {
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      chat.toolConfirmations.subscribe(onStoreChange),
    [chat],
  )
  const getSnapshot = useCallback(
    () => chat.toolConfirmations.getSnapshot(),
    [chat],
  )
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export type UseToolConfirmationSyncOptions = {
  /** Default true. Pass false when the transport cannot read confirmations. */
  enabled?: boolean
  /** Polling while some shown action is pending or running. Default 15 s. */
  intervalMs?: number
}

export type ToolConfirmationSync = {
  /** The last refresh failed: cards show their state as unverified. */
  error: unknown
  refresh: () => Promise<void>
}

/**
 * Keeps the cards' state in line with the server: on mount and history loads,
 * when the tab regains focus or the connection, and periodically while some
 * action can still change. A stream already updates the store by itself.
 */
export function useToolConfirmationSync(
  chat: PlaiChat,
  { enabled = true, intervalMs = 15_000 }: UseToolConfirmationSyncOptions = {},
): ToolConfirmationSync {
  const [error, setError] = useState<unknown>(null)
  const inFlight = useRef<Promise<void> | null>(null)
  const snapshot = useToolConfirmations(chat)
  const messages = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => chat.subscribe(onStoreChange),
      [chat],
    ),
    useCallback(() => chat.getState().messages, [chat]),
    useCallback(() => chat.getInitialState().messages, [chat]),
  )
  const shownIds = pendingActionIds(messages).join(",")

  const refresh = useCallback(async () => {
    if (!enabled) return
    if (inFlight.current) return inFlight.current
    const run = chat
      .refreshToolConfirmations()
      .then(() => setError(null))
      .catch((reason: unknown) => setError(reason))
      .finally(() => {
        inFlight.current = null
      })
    inFlight.current = run
    return run
  }, [chat, enabled])

  // Mount, thread switch and every time other held actions are shown.
  useEffect(() => {
    if (shownIds) void refresh()
  }, [refresh, shownIds])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    const onOnline = () => void refresh()
    window.addEventListener("focus", onOnline)
    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("focus", onOnline)
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [enabled, refresh])

  const hasOpen =
    shownIds.length > 0 &&
    shownIds.split(",").some((actionId) => {
      const item = snapshot.items[actionId]
      return !item || OPEN_TOOL_CONFIRMATION_STATUSES.has(item.status)
    })

  useEffect(() => {
    if (!enabled || !hasOpen || intervalMs <= 0) return
    const timer = setInterval(() => void refresh(), intervalMs)
    return () => clearInterval(timer)
  }, [enabled, hasOpen, intervalMs, refresh])

  return { error, refresh }
}
