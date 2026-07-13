export type DatasourceToolResultCardProps = {
  title: string
  description: string
  type: string
}

type DatasourceToolResultCardContentProps = DatasourceToolResultCardProps & {
  resourceCount?: number
}

export function DatasourceIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.75" y="3.25" width="13" height="11" rx="1.5" />
      <path d="M2.75 7h13" />
      <rect
        x="10.25"
        y="10.25"
        width="7"
        height="6.5"
        rx="1.25"
        fill="#f5f5f5"
      />
      <path d="M10.25 13.25h7" />
    </svg>
  )
}

export function DatasourceToolResultCardContent({
  title,
  description,
  type,
  resourceCount,
}: DatasourceToolResultCardContentProps) {
  return (
    <>
      <header className="flex items-center gap-3">
        <DatasourceIcon />
        <p className="min-w-0 truncate text-base leading-5">{type}</p>
      </header>

      <h3 className="mt-3 line-clamp-2 text-sm font-normal leading-5">
        {title}
      </h3>
      <p className="mt-2 line-clamp-2 text-xs leading-4">{description}</p>
      {resourceCount === undefined ? null : (
        <p className="mt-2 text-xs leading-4 text-neutral-600">
          {resourceCount} {resourceCount === 1 ? "Recurso" : "Recursos"}
        </p>
      )}
    </>
  )
}

export function DatasourceToolResultCard(props: DatasourceToolResultCardProps) {
  return (
    <article
      aria-label={`${props.type}: ${props.title}`}
      className="w-[186px] rounded-lg bg-neutral-100 p-4 text-neutral-950"
    >
      <DatasourceToolResultCardContent {...props} />
    </article>
  )
}
