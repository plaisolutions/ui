import { RotateCcw } from "lucide-react"
import type { ButtonHTMLAttributes } from "react"
import { joinClasses } from "./internal/join-classes"

type ReloadClickHandler = NonNullable<
  ButtonHTMLAttributes<HTMLButtonElement>["onClick"]
>

export type ReloadProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick"
> & {
  label?: string
  onClick: ReloadClickHandler
}

export function Reload({
  label = "Retry response",
  className,
  type = "button",
  ...props
}: ReloadProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={joinClasses(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <RotateCcw className="size-4" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </button>
  )
}
