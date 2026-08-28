import type { UIThinkingPart } from "@plaisolutions/client"
import { Brain, ChevronDown, LoaderCircle } from "lucide-react"
import type { HTMLAttributes } from "react"
import { useEffect, useId, useRef, useState } from "react"
import { joinClasses } from "./internal/join-classes"

export type ThinkingProps = Omit<HTMLAttributes<HTMLElement>, "part"> & {
  part: UIThinkingPart
  thinkingLabel?: string
  completedLabel?: string
  defaultOpen?: boolean
}

export function Thinking({
  part,
  thinkingLabel = "Thinking…",
  completedLabel = "Thought process",
  defaultOpen,
  className,
  ...props
}: ThinkingProps) {
  const isStreaming = part.state === "streaming"
  const hasContent = Boolean(part.thinking.trim())
  const [isOpen, setIsOpen] = useState(defaultOpen ?? isStreaming)
  const previousState = useRef(part.state)
  const contentId = useId()
  const label = isStreaming ? thinkingLabel : completedLabel

  useEffect(() => {
    if (previousState.current === "streaming" && !isStreaming) {
      setIsOpen(false)
    }
    previousState.current = part.state
  }, [isStreaming, part.state])

  return (
    <section
      className={joinClasses("text-sm text-neutral-600 dark:text-neutral-300", className)}
      data-thinking-state={part.state}
      {...props}
    >
      <button
        type="button"
        aria-controls={hasContent ? contentId : undefined}
        aria-expanded={hasContent ? isOpen : undefined}
        aria-label={
          hasContent
            ? `${isOpen ? "Collapse" : "Expand"} ${label}`
            : label
        }
        disabled={!hasContent}
        className={joinClasses(
          "inline-flex items-center gap-2 rounded-md py-1 text-left font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-neutral-100",
          hasContent
            ? "cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100"
            : "cursor-default",
        )}
        onClick={() => setIsOpen((value) => !value)}
      >
        {isStreaming ? (
          <LoaderCircle
            className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Brain className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span>{label}</span>
        {hasContent ? (
          <ChevronDown
            className={joinClasses(
              "size-4 shrink-0 transition-transform motion-reduce:transition-none",
              isOpen ? "rotate-180" : undefined,
            )}
            aria-hidden="true"
          />
        ) : null}
      </button>
      <span className="sr-only" aria-live="polite">
        {isStreaming ? "Thinking in progress" : "Thinking complete"}
      </span>
      {hasContent && isOpen ? (
        <p
          id={contentId}
          className="mt-1 whitespace-pre-wrap border-l-2 border-neutral-200 pl-3 text-sm leading-6 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
        >
          {part.thinking}
        </p>
      ) : null}
    </section>
  )
}
