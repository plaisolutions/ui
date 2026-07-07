import type { ChatStatus, SendMessageInput } from "@plaisolutions/client"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { useLayoutEffect, useRef, useState } from "react"
import { ArrowUp } from "../icons/arrow"
import { Stop } from "../icons/stop"
import { joinClasses } from "../internal/join-classes"

const actionButtonClassName =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"

const defaultMaxRows = 4

function resizeTextarea(textarea: HTMLTextAreaElement, maxRows: number) {
  const styles = getComputedStyle(textarea)
  const lineHeight = Number.parseFloat(styles.lineHeight)
  const paddingTop = Number.parseFloat(styles.paddingTop)
  const paddingBottom = Number.parseFloat(styles.paddingBottom)
  const maxHeight = lineHeight * maxRows + paddingTop + paddingBottom

  textarea.style.height = "auto"
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
  textarea.style.overflowY =
    textarea.scrollHeight > maxHeight ? "auto" : "hidden"
}

export type PromptFormIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export function PromptFormIconButton({
  className,
  type = "button",
  ...props
}: PromptFormIconButtonProps) {
  return (
    <button
      type={type}
      className={joinClasses(actionButtonClassName, className)}
      {...props}
    />
  )
}

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
  maxRows?: number
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
  maxRows = defaultMaxRows,
  submitButtonClassName,
  stopButtonClassName,
  leftSlot,
  rightSlot,
}: PromptFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isStreaming = status === "streaming" || status === "submitted"
  const canSubmit =
    !disabled && !isSubmitting && !isStreaming && value.trim().length > 0

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      resizeTextarea(textarea, maxRows)
    }
  }, [maxRows])

  return (
    <form
      className={joinClasses(
        "flex w-full items-end gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3",
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
          queueMicrotask(() => {
            const textarea = textareaRef.current
            if (textarea) {
              resizeTextarea(textarea, maxRows)
            }
          })
        }
      }}
    >
      {leftSlot ?? null}
      <textarea
        ref={textareaRef}
        rows={1}
        className={joinClasses(
          "min-h-10 flex-1 resize-none overflow-hidden border-0 bg-transparent px-0 py-1.5 text-sm leading-6 text-neutral-900 outline-none placeholder:text-neutral-400",
          textareaClassName,
        )}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value)
          resizeTextarea(event.currentTarget, maxRows)
        }}
        placeholder={placeholder}
        disabled={disabled || isSubmitting}
      />
      <div className="flex shrink-0 items-center gap-2">
        {rightSlot ?? null}
        {isStreaming ? (
          <PromptFormIconButton
            aria-label={stopLabel}
            className={stopButtonClassName}
            onClick={onStop}
            disabled={disabled || !onStop}
          >
            <Stop className="size-4" />
          </PromptFormIconButton>
        ) : (
          <PromptFormIconButton
            type="submit"
            aria-label={sendLabel}
            className={submitButtonClassName}
            disabled={!canSubmit}
          >
            <ArrowUp className="size-4" />
          </PromptFormIconButton>
        )}
      </div>
    </form>
  )
}
