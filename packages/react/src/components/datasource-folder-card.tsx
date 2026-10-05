import {
  DatasourceIcon,
  DatasourceToolResultCardContent,
} from "./datasource-tool-result-card"
import { ResourceCard, type ResourceCardProps } from "./resource-card"
import { getUiCopy } from "./internal/ui-copy"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"

export type DatasourceFolderCardProps = {
  icon?: string
  title: string
  description: string
  type: string
  url?: string | null
  resources: ResourceCardProps[]
  variant?: "card" | "list"
  locale?: string | null
}

export function DatasourceFolderCard({
  icon,
  title,
  description,
  type,
  url,
  resources,
  variant = "card",
  locale,
}: DatasourceFolderCardProps) {
  const copy = getUiCopy(locale)
  return (
    <Sheet>
      <SheetTrigger
        aria-label={`${type}: ${title}`}
        className={`${
          variant === "card" ? "min-h-[183px] w-[186px] max-w-full" : "w-full"
        } rounded-lg bg-neutral-100 p-4 text-left font-normal text-neutral-950 transition-colors hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950`}
      >
        <DatasourceToolResultCardContent
          icon={icon}
          title={title}
          description={description}
          type={type}
          resourceCount={resources.length}
          locale={locale}
        />
      </SheetTrigger>

      <SheetContent locale={locale}>
        <SheetHeader className="pr-10">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              {icon ? (
                <img src={icon} alt="" className="size-5 object-contain" />
              ) : (
                <DatasourceIcon />
              )}
            </span>
            <SheetTitle>{title}</SheetTitle>
          </div>
          {description ? (
            <SheetDescription className="line-clamp-2 text-xs leading-4">
              {description}
            </SheetDescription>
          ) : null}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs font-medium text-neutral-700 underline underline-offset-2"
            >
              {copy.view}
            </a>
          ) : null}
        </SheetHeader>

        <section className="mt-5" aria-label={copy.resources}>
          <h3 className="text-xs font-medium leading-4">{copy.view}</h3>
          <div className="mt-7 space-y-3">
            {resources.map((resource, index) => (
              <ResourceCard
                key={`${resource.url ?? resource.title}-${index}`}
                {...resource}
                variant="list"
              />
            ))}
          </div>
        </section>
      </SheetContent>
    </Sheet>
  )
}
