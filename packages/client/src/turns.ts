import type { UIMessage, UIMessagePart, UIToolCallPart } from "./types"

/** Presentation only: keep the provider's individual turns in backend storage. */
export function groupAssistantMessages(messages: UIMessage[]): UIMessage[] {
  const grouped: UIMessage[] = []
  for (const message of messages) {
    const previous = grouped.at(-1)
    if (message.role !== "assistant" || previous?.role !== "assistant") {
      grouped.push(message)
      continue
    }
    const parts = [...previous.parts]
    const legacyTool = message.metadata?.metadata?.legacyToolMessage === true
    for (const part of message.parts) {
      const index =
        legacyTool && part.type === "tool-call"
          ? parts.findIndex(
              (candidate) =>
                candidate.type === "tool-call" && candidate.id === part.id,
            )
          : -1
      const original = parts[index]
      if (part.type === "tool-call" && original?.type === "tool-call") {
        parts[index] = {
          ...original,
          toolType:
            part.toolType === "unknown" ? original.toolType : part.toolType,
          state: part.state,
          result: part.result,
          errorDetails: part.errorDetails,
          metadata: { ...original.metadata, ...part.metadata },
        } as UIToolCallPart
      } else {
        parts.push(part)
      }
    }
    // Legacy tool rows have no assistant persistence identity of their own.
    grouped[grouped.length - 1] = {
      ...(legacyTool ? previous : message),
      parts,
    }
  }
  return grouped
}

/** A guardrail is terminal output too, but must never expose a preamble to Copy. */
export function getAssistantTurnContent(parts: UIMessagePart[]) {
  let split = parts.length
  while (split > 0 && ["text", "guardrail"].includes(parts[split - 1].type))
    split--
  const leadingParts = parts.slice(0, split)
  const finalParts = parts.slice(split)
  const hasGuardrail = finalParts.some((part) => part.type === "guardrail")
  const finalText = hasGuardrail
    ? ""
    : finalParts
        .filter((part) => part.type === "text")
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("\n")
  const hasFinalResponse = finalText.trim().length > 0 || hasGuardrail
  return { leadingParts, finalParts, finalText, hasFinalResponse }
}

/** A persisted id may arrive before message_stop; both conditions are needed. */
export function canShowAssistantTurnActions(message: UIMessage): boolean {
  return (
    message.role === "assistant" &&
    message.metadata?.completed === true &&
    Boolean(message.metadata.persistedMessageId) &&
    getAssistantTurnContent(message.parts).finalText.trim().length > 0
  )
}
