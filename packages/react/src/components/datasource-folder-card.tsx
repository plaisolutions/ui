import {
  DatasourceIcon,
  DatasourceToolResultCardContent,
} from "./datasource-tool-result-card"
import { ResourceCard, type ResourceCardProps } from "./resource-card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"

export type DatasourceFolderCardProps = {
  title: string
  description: string
  type: string
  resources: ResourceCardProps[]
}

export function DatasourceFolderCard({
  title,
  description,
  type,
  resources,
}: DatasourceFolderCardProps) {
  return (
    <Sheet>
      <SheetTrigger
        aria-label={`${type}: ${title}`}
        className="min-h-[183px] w-[186px] rounded-lg bg-neutral-100 p-4 text-left font-normal text-neutral-950 transition-colors hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
      >
        <DatasourceToolResultCardContent
          title={title}
          description={description}
          type={type}
          resourceCount={resources.length}
        />
      </SheetTrigger>

      <SheetContent closeLabel="Cerrar">
        <SheetHeader className="pr-10">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              <DatasourceIcon />
            </span>
            <SheetTitle>{title}</SheetTitle>
          </div>
          {description ? (
            <SheetDescription className="line-clamp-2 text-xs leading-4">
              {description}
            </SheetDescription>
          ) : null}
        </SheetHeader>

        <section className="mt-5" aria-label="Recursos">
          <h3 className="text-xs font-medium leading-4">Ver</h3>
          <div className="mt-7 space-y-3">
            {resources.map((resource, index) => (
              <ResourceCard
                key={`${resource.url ?? resource.title}-${index}`}
                {...resource}
              />
            ))}
          </div>
        </section>
      </SheetContent>
    </Sheet>
  )
}
