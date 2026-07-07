import type { ChatStatus } from "@plaisolutions/client"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { useLayoutEffect, useRef, useState } from "react"
import { ArrowUp } from "../icons/arrow"
import { Stop } from "../icons/stop"
import { X } from "../icons/x"
import { joinClasses } from "../internal/join-classes"
import {
  PROMPT_FORM_FILE_ACCEPT,
  partitionPromptFormFiles,
} from "./file-attachments"
import type { InvalidPromptFormFile } from "./file-attachments"
import { PromptFormAttachButton } from "./prompt-form-attach-button"

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

export type PromptFormSubmitInput = {
  text: string
  enabledTools?: string[]
  files: File[]
}

export type PromptFormProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (input: PromptFormSubmitInput) => void | Promise<void>
  status?: ChatStatus
  onStop?: () => void
  disabled?: boolean
  clearOnSubmit?: boolean
  enabledTools?: string[]
  placeholder?: string
  sendLabel?: string
  stopLabel?: string
  attachLabel?: string
  removeFileLabel?: string
  enableAttachments?: boolean
  files?: File[]
  onFilesChange?: (files: File[]) => void
  onInvalidFiles?: (invalidFiles: InvalidPromptFormFile[]) => void
  accept?: string
  className?: string
  textareaClassName?: string
  attachmentsClassName?: string
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
  enabledTools,
  placeholder = "Type a message...",
  sendLabel = "Send",
  stopLabel = "Stop",
  attachLabel = "Attach file",
  removeFileLabel = "Remove file",
  enableAttachments = true,
  files: filesProp,
  onFilesChange,
  onInvalidFiles,
  accept = PROMPT_FORM_FILE_ACCEPT,
  className,
  textareaClassName,
  attachmentsClassName,
  maxRows = defaultMaxRows,
  submitButtonClassName,
  stopButtonClassName,
  leftSlot,
  rightSlot,
}: PromptFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [internalFiles, setInternalFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const files = filesProp ?? internalFiles
  const setFiles = onFilesChange ?? setInternalFiles
  const isStreaming = status === "streaming" || status === "submitted"
  const hasContent = value.trim().length > 0 || files.length > 0
  const canSubmit = !disabled && !isSubmitting && !isStreaming && hasContent
  const isInteractionDisabled = disabled || isSubmitting

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      resizeTextarea(textarea, maxRows)
    }
  }, [maxRows])

  function addFiles(nextFiles: File[]) {
    const { validFiles, invalidFiles } = partitionPromptFormFiles(nextFiles)

    if (invalidFiles.length > 0) {
      onInvalidFiles?.(invalidFiles)
    }

    if (validFiles.length > 0) {
      setFiles([...files, ...validFiles])
    }
  }

  function removeFile(index: number) {
    setFiles(files.filter((_, fileIndex) => fileIndex !== index))
  }

  return (
    <form
      className={joinClasses(
        "flex w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white",
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
          const selectedFiles = [...files]
          await onSubmit({
            text,
            ...(enabledTools ? { enabledTools } : {}),
            files: selectedFiles,
          })
          if (clearOnSubmit) {
            onValueChange("")
            setFiles([])
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
      <div className="flex items-end gap-3 px-4 py-3">
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
          disabled={isInteractionDisabled}
        />
        <div className="flex shrink-0 items-center gap-2">
          {enableAttachments ? (
            <PromptFormAttachButton
              accept={accept}
              disabled={isInteractionDisabled}
              label={attachLabel}
              onFilesSelected={addFiles}
              onInvalidFiles={onInvalidFiles}
            />
          ) : null}
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
      </div>
      {files.length > 0 ? (
        <div
          className={joinClasses(
            "flex flex-wrap gap-2 border-t border-neutral-200 px-4 py-2",
            attachmentsClassName,
          )}
        >
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}-${index}`}
              className="flex max-w-full items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-700"
            >
              <span className="max-w-[150px] truncate">{file.name}</span>
              <button
                type="button"
                className="text-neutral-500 transition-colors hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`${removeFileLabel}: ${file.name}`}
                disabled={isInteractionDisabled}
                onClick={() => removeFile(index)}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </form>
  )
}
