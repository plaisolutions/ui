import type {
  ChatRegistry,
  PlaiChat,
  StreamCoordinator,
  StreamCoordinatorSnapshot,
} from "@plaisolutions/client"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

/**
 * Owns a registry for the lifetime of the component and of `resetKey`.
 *
 * Creation and disposal are symmetric: a disposed registry is never handed out
 * again, so the extra setup → cleanup → setup of StrictMode, or a change of
 * `resetKey` (for example the chat session), yields a fresh registry.
 */
export function useOwnedChatRegistry(
  create: () => ChatRegistry,
  resetKey: unknown,
): ChatRegistry {
  const createRef = useRef(create)
  createRef.current = create
  let [owned, setOwned] = useState(() => ({
    resetKey,
    registry: create(),
  }))

  if (!Object.is(owned.resetKey, resetKey)) {
    // Derived during render so children never see the previous key's registry.
    owned = { resetKey, registry: create() }
    setOwned(owned)
  }

  useEffect(() => {
    // Checked at run time: StrictMode re-runs this effect with the same closure
    // after disposing the registry in the simulated cleanup.
    if (owned.registry.isDisposed()) {
      setOwned({ resetKey: owned.resetKey, registry: createRef.current() })
      return
    }
    const { registry } = owned
    return () => {
      registry.dispose()
    }
  }, [owned])

  // While a replacement is pending, a disposed registry hands out detached
  // instances and rejects invocations: nothing can start on it.
  return owned.registry
}

/**
 * Instance of `key` in `registry`, retained while the component is mounted.
 * Unmounting only drops the retention; it never stops the stream.
 */
export function useRegistryChat(registry: ChatRegistry, key: string): PlaiChat {
  const subscribe = useCallback(
    (onStoreChange: () => void) => registry.subscribe(onStoreChange),
    [registry],
  )
  // getOrCreate is idempotent and never notifies, so it is safe as a snapshot.
  const getSnapshot = useCallback(
    () => registry.getOrCreate(key),
    [registry, key],
  )
  const chat = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    void chat
    return registry.retain(key)
  }, [registry, key, chat])

  return chat
}

/** Keys with an operation, a stream or an upload in progress. */
export function useChatRegistryBusy(
  registry: ChatRegistry,
): ReadonlySet<string> {
  const subscribe = useCallback(
    (onStoreChange: () => void) => registry.subscribe(onStoreChange),
    [registry],
  )
  const getSnapshot = useCallback(() => registry.busyKeys(), [registry])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Occupied slots and limit of a shared coordinator. */
export function useStreamCoordinator(
  coordinator: StreamCoordinator,
): StreamCoordinatorSnapshot {
  const subscribe = useCallback(
    (onStoreChange: () => void) => coordinator.subscribe(onStoreChange),
    [coordinator],
  )
  const getSnapshot = useCallback(
    () => coordinator.getSnapshot(),
    [coordinator],
  )
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
