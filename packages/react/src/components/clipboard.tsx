import { Check, Copy } from "lucide-react"
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { joinClasses } from "./internal/join-classes"

export type ClipboardState = {
  isCopied: boolean
  isCopying: boolean
}

export type ClipboardProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onCopy"
> & {
  text: string
  onCopy?: (text: string) => void | Promise<void>
  copiedDuration?: number
  copyLabel?: string
  copiedLabel?: string
  children?: ReactNode | ((state: ClipboardState) => ReactNode)
}

async function writeTextToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is not available in this environment.")
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()

  try {
    if (!document.execCommand("copy")) {
      throw new Error("The browser rejected the clipboard operation.")
    }
  } finally {
    textarea.remove()
  }
}

export function Clipboard({
  text,
  onCopy,
  copiedDuration = 2000,
  copyLabel = "Copy",
  copiedLabel = "Copied",
  children,
  className,
  disabled,
  onClick,
  type = "button",
  ...props
}: ClipboardProps) {
  const [isCopied, setIsCopied] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event)
    if (event.defaultPrevented || disabled || isCopying) return

    setIsCopying(true)
    try {
      await writeTextToClipboard(text)
      setIsCopied(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setIsCopied(false), copiedDuration)

      try {
        await onCopy?.(text)
      } catch {
        // Copying already succeeded. Consumer callbacks must not undo feedback.
      }
    } catch {
      setIsCopied(false)
    } finally {
      setIsCopying(false)
    }
  }

  const state = { isCopied, isCopying }

  return (
    <button
      type={type}
      aria-label={isCopied ? copiedLabel : copyLabel}
      className={joinClasses(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      disabled={disabled || isCopying}
      onClick={handleClick}
      {...props}
    >
      {typeof children === "function" ? (
        children(state)
      ) : children !== undefined && children !== null ? (
        children
      ) : isCopied ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      <span className="sr-only" aria-live="polite">
        {isCopied ? copiedLabel : copyLabel}
      </span>
    </button>
  )
}
