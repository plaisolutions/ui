import type {
  UIMessage,
  UiActionContext,
  UiActionEffect,
  UiActionHandlersSource,
  UiActionIssue,
} from "./types"

type DispatchInput = { toolUseId: string; replay: boolean }

/**
 * Runs the UI effects a tool declared (`ui_action`) with the handlers the host app registers.
 *
 * The API does not know what an `action` means: each app maps the slug to a function. The
 * payload is untrusted input, so a handler sanitizes it (no `innerHTML`, no unchecked URLs).
 * An effect with no handler or a handler that throws never interrupts the stream; it is
 * reported through `onIssue`.
 */
export class UiActionDispatcher {
  private handlers: UiActionHandlersSource | undefined

  private readonly onIssue?: (issue: UiActionIssue) => void

  /** `action_id`s already applied: the stream and a history reload can deliver the same one. */
  private readonly applied = new Set<string>()

  constructor(
    options: {
      handlers?: UiActionHandlersSource
      onIssue?: (issue: UiActionIssue) => void
    } = {},
  ) {
    this.handlers = options.handlers
    this.onIssue = options.onIssue
  }

  /** The host app can change its handlers between renders. */
  setHandlers(handlers: UiActionHandlersSource | undefined): void {
    this.handlers = handlers
  }

  /** Applies one effect. Returns false when it was a duplicate or had no usable handler. */
  dispatch(effect: UiActionEffect, input: DispatchInput): boolean {
    if (this.applied.has(effect.action_id)) return false

    const handlers =
      typeof this.handlers === "function" ? this.handlers() : this.handlers
    const handler = handlers?.[effect.action]
    if (!handler) {
      // Not marked as applied: a handler registered later (replay on mount) can still run it.
      this.onIssue?.({
        type: "ui_action.unmapped",
        action: effect.action,
        actionId: effect.action_id,
        toolUseId: input.toolUseId,
      })
      return false
    }

    this.applied.add(effect.action_id)
    const context: UiActionContext = {
      actionId: effect.action_id,
      toolUseId: input.toolUseId,
      replay: input.replay,
    }
    const fail = (error: unknown) =>
      this.onIssue?.({
        type: "ui_action.failed",
        action: effect.action,
        actionId: effect.action_id,
        toolUseId: input.toolUseId,
        error,
      })
    try {
      const result = handler(effect.payload, context)
      if (result && typeof (result as Promise<void>).catch === "function") {
        void (result as Promise<void>).catch(fail)
      }
    } catch (error) {
      fail(error)
    }
    return true
  }

  /**
   * Re-applies, in order, the `replayable` effects stored in a conversation's history. Only the
   * interface is rebuilt: any domain mutation already happened on the server. Effects the
   * stream already applied are skipped by `action_id`.
   */
  replay(messages: UIMessage[]): void {
    for (const message of messages) {
      if (message.role !== "assistant") continue
      for (const part of message.parts) {
        if (part.type !== "tool-call") continue
        const effect = parseUiActionEffect(part.metadata?.ui_action)
        if (!effect || !effect.replayable) continue
        this.dispatch(effect, { toolUseId: part.id, replay: true })
      }
    }
  }
}

/** The effect in a wire object, or `undefined` when it is malformed. */
export function parseUiActionEffect(
  value: unknown,
): UiActionEffect | undefined {
  if (!value || typeof value !== "object") return undefined
  const effect = value as Record<string, unknown>
  if (typeof effect.action_id !== "string" || !effect.action_id)
    return undefined
  if (typeof effect.action !== "string" || !effect.action) return undefined
  const payload = effect.payload
  return {
    action_id: effect.action_id,
    action: effect.action,
    payload:
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {},
    // The API defaults it to true; anything but an explicit false replays.
    replayable: effect.replayable !== false,
  }
}
