import { File } from "lucide-react"

export type ResourceCardProps = {
  icon?: string
  title: string
  description: string
  url: string | null
}

function ResourceCardContent({
  icon,
  title,
  description,
}: Omit<ResourceCardProps, "url">) {
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
        <p className="min-w-0 truncate text-base leading-5">{title}</p>
      </header>
      <p className="mt-2 line-clamp-2 text-sm leading-5">{description}</p>
    </>
  )
}

export function ResourceCard(props: ResourceCardProps) {
  const className =
    "block w-full rounded-lg bg-neutral-100 p-4 text-left text-neutral-950"

  if (!props.url) {
    return (
      <article
        aria-label={`${props.title}: ${props.description}`}
        className={className}
      >
        <ResourceCardContent {...props} />
      </article>
    )
  }

  return (
    <a
      href={props.url}
      target="_blank"
      rel="noreferrer noopener"
      className={`${className} transition-colors hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950`}
    >
      <ResourceCardContent {...props} />
    </a>
  )
}
