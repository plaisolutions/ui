import { ThumbsDown, ThumbsUp } from "lucide-react"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { joinClasses } from "./internal/join-classes"
import { getUiCopy } from "./internal/ui-copy"

type ThumbButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  icon: ReactNode
}

function ThumbButton({
  label,
  icon,
  className,
  type = "button",
  ...props
}: ThumbButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={joinClasses(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-strong transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-inverse aria-pressed:bg-inverse aria-pressed:text-inverse-foreground",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  )
}

type ThumbClickHandler = NonNullable<
  ButtonHTMLAttributes<HTMLButtonElement>["onClick"]
>

export type ThumbUpProps = Omit<
  ThumbButtonProps,
  "icon" | "label" | "onClick"
> & {
  label?: string
  locale?: string | null
  onClick: ThumbClickHandler
}

export function ThumbUp({ label, locale, ...props }: ThumbUpProps) {
  return (
    <ThumbButton
      label={label ?? getUiCopy(locale).ratePositively}
      icon={<ThumbsUp className="size-4" aria-hidden="true" />}
      {...props}
    />
  )
}

export type ThumbDownProps = Omit<
  ThumbButtonProps,
  "icon" | "label" | "onClick"
> & {
  label?: string
  locale?: string | null
  onClick: ThumbClickHandler
}

export function ThumbDown({
  label,
  locale,
  ...props
}: ThumbDownProps) {
  return (
    <ThumbButton
      label={label ?? getUiCopy(locale).rateNegatively}
      icon={<ThumbsDown className="size-4" aria-hidden="true" />}
      {...props}
    />
  )
}
