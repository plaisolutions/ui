import { RotateCcw } from "lucide-react"
import type { ButtonHTMLAttributes } from "react"
import { joinClasses } from "./internal/join-classes"
import { getUiCopy } from "./internal/ui-copy"

type ReloadClickHandler = NonNullable<
  ButtonHTMLAttributes<HTMLButtonElement>["onClick"]
>

export type ReloadProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick"
> & {
  label?: string
  locale?: string | null
  onClick: ReloadClickHandler
}

export function Reload({
  label,
  locale,
  className,
  type = "button",
  ...props
}: ReloadProps) {
  const resolvedLabel = label ?? getUiCopy(locale).retryResponse
  return (
    <button
      type={type}
      aria-label={resolvedLabel}
      className={joinClasses(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-strong transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <RotateCcw className="size-4" aria-hidden="true" />
      <span className="sr-only">{resolvedLabel}</span>
    </button>
  )
}
