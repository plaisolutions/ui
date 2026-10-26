export type StreamCoordinatorOptions = {
  /** Maximum concurrent operations. Omit for no limit. */
  maxActiveStreams?: number
}

export type StreamCoordinatorSnapshot = Readonly<{
  occupied: number
  limit: number | null
}>

/**
 * Budget of concurrent chat operations shared by every registry of a host.
 *
 * A slot is reserved synchronously, so two admissions racing for the last slot
 * cannot both succeed. It is a local limit: other tabs, iframes with their own
 * coordinator or server-side runs are not counted.
 */
export class StreamCoordinator {
  private readonly limit: number | null

  private occupied = 0

  private snapshot: StreamCoordinatorSnapshot

  private readonly listeners = new Set<() => void>()

  constructor(options: StreamCoordinatorOptions = {}) {
    const { maxActiveStreams } = options
    if (
      maxActiveStreams !== undefined &&
      (!Number.isInteger(maxActiveStreams) || maxActiveStreams < 1)
    ) {
      throw new RangeError("maxActiveStreams must be a positive integer.")
    }
    this.limit = maxActiveStreams ?? null
    this.snapshot = { occupied: 0, limit: this.limit }
  }

  /** Reserves a slot. Returns an idempotent release, or `null` when full. */
  tryAcquire(): (() => void) | null {
    if (!this.canStartStream()) return null
    this.occupied += 1
    this.publish()

    let released = false
    return () => {
      if (released) return
      released = true
      this.occupied -= 1
      this.publish()
    }
  }

  /** Informative only: admission must go through `tryAcquire`. */
  canStartStream(): boolean {
    return this.limit === null || this.occupied < this.limit
  }

  getSnapshot(): StreamCoordinatorSnapshot {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private publish(): void {
    this.snapshot = { occupied: this.occupied, limit: this.limit }
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (error) {
        console.error(error)
      }
    }
  }
}
