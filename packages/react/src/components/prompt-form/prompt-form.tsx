import type { ChatStatus, SendMessageInput } from "@plaisolutions/client"
import type { ReactNode } from "react"
import { useState } from "react"
import { joinClasses } from "../internal/join-classes"

export type PromptFormProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (input: SendMessageInput) => void | Promise<void>
  status?: ChatStatus
  onStop?: () => void
  disabled?: boolean
  clearOnSubmit?: boolean
  placeholder?: string
  sendLabel?: string
  stopLabel?: string
  className?: string
  textareaClassName?: string
  submitButtonClassName?: string
  stopButtonClassName?: string
  leftSlot?: ReactNode
  rightSlot?: ReactNode
}

export function PromptForm({
  value,
  onValueChange,
  onSubmit,
  status = "ready",
  onStop,
  disabled = false,
  clearOnSubmit = true,
  placeholder = "Type a message...",
  sendLabel = "Send",
  stopLabel = "Stop",
  className,
  textareaClassName,
  submitButtonClassName,
  stopButtonClassName,
  leftSlot,
  rightSlot,
}: PromptFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isStreaming = status === "streaming" || status === "submitted"
  const canSubmit =
    !disabled && !isSubmitting && !isStreaming && value.trim().length > 0

  return (
    <form
      className={joinClasses(
        "flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm",
        className,
      )}
      onSubmit={async (event) => {
        event.preventDefault()
        if (!canSubmit) {
          return
        }
        setIsSubmitting(true)
        try {
          const text = value.trim()
          await onSubmit({ text })
          if (clearOnSubmit) {
            onValueChange("")
          }
        } finally {
          setIsSubmitting(false)
        }
      }}
    >
      {leftSlot ?? null}
      <textarea
        className={joinClasses(
          "max-h-40 min-h-10 flex-1 resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400",
          textareaClassName,
        )}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled || isSubmitting}
      />
      {isStreaming ? (
        <button
          type="button"
          className={joinClasses(
            "rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60",
            stopButtonClassName,
          )}
          onClick={onStop}
          disabled={disabled || !onStop}
        >
          {stopLabel}
        </button>
      ) : (
        <button
          type="submit"
          className={joinClasses(
            "rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400",
            submitButtonClassName,
          )}
          disabled={!canSubmit}
        >
          {sendLabel}
        </button>
      )}
      {rightSlot ?? null}
    </form>
  )
}
