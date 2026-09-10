import { File } from "lucide-react"
import { joinClasses } from "./internal/join-classes"

export type ResourceCardProps = {
  icon?: string
  type?: string
  title: string
  description?: string
  url: string | null
  variant?: "card" | "list"
  className?: string
}

function ResourceCardContent({
  icon,
  type,
  title,
  description,
}: Omit<ResourceCardProps, "url" | "variant" | "className">) {
  const heading = type ?? title
  const bodyTitle = type ? title : description
  const bodyDescription = type ? description : undefined

  return (
    <>
      <header className="flex min-w-0 items-center gap-3">
        {icon ? (
          <img
            src={icon}
            alt=""
            width="20"
            height="20"
            className="h-5 w-5 shrink-0 object-contain"
          />
        ) : (
          <File className="h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <p className="min-w-0 truncate text-base leading-5">{heading}</p>
      </header>
      {bodyTitle ? (
        <p className="mt-2 line-clamp-2 text-sm font-medium leading-5">
          {bodyTitle}
        </p>
      ) : null}
      {bodyDescription ? (
        <p className="mt-2 line-clamp-2 text-xs leading-4 text-neutral-600">
          {bodyDescription}
        </p>
      ) : null}
    </>
  )
}

export function ResourceCard(props: ResourceCardProps) {
  const {
    className: customClassName,
    variant = "card",
    ...contentProps
  } = props
  const className = joinClasses(
    "block rounded-lg bg-neutral-100 p-4 text-left text-neutral-950",
    variant === "card" ? "min-h-[183px] w-[186px] max-w-full" : "w-full",
    customClassName,
  )

  if (!contentProps.url) {
    return (
      <article
        aria-label={`${contentProps.title}: ${contentProps.description}`}
        className={className}
      >
        <ResourceCardContent {...contentProps} />
      </article>
    )
  }

  return (
    <a
      href={contentProps.url}
      target="_blank"
      rel="noreferrer noopener"
      className={`${className} transition-colors hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950`}
    >
      <ResourceCardContent {...contentProps} />
    </a>
  )
}
