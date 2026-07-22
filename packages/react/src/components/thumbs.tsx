import { ThumbsDown, ThumbsUp } from "lucide-react"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { joinClasses } from "./internal/join-classes"

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
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-neutral-950 aria-pressed:bg-neutral-950 aria-pressed:text-white",
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
  onClick: ThumbClickHandler
}

export function ThumbUp({ label = "Rate positively", ...props }: ThumbUpProps) {
  return (
    <ThumbButton
      label={label}
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
  onClick: ThumbClickHandler
}

export function ThumbDown({
  label = "Rate negatively",
  ...props
}: ThumbDownProps) {
  return (
    <ThumbButton
      label={label}
      icon={<ThumbsDown className="size-4" aria-hidden="true" />}
      {...props}
    />
  )
}
