import type {
  GetResourceDownloadUrlFn,
  ResourceReadModel,
  UIDatasourceToolCallPart,
  UIFirecrawlSearchToolCallPart,
  UIMessagePart,
  UIPerplexityToolCallPart,
} from "@plaisolutions/client"
import { Globe } from "lucide-react"
import {
  DatasourceResourceCardView,
  getDatasourceResourceCards,
  isDatasourceResource,
  type DatasourceResourceCard,
} from "./datasource-tool-resources"
import { joinClasses } from "./internal/join-classes"
import { getSupportedToolLocale } from "./internal/tool-locale"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"
import {
  getWebSearchResults,
  ToolResultWebSearchCard,
  ToolResultWebSearchResults,
} from "./tool-result-web-search-card"

export type SourceToolPart =
  | UIDatasourceToolCallPart
  | UIFirecrawlSearchToolCallPart
  | UIPerplexityToolCallPart

type AggregatedSourceCard =
  | {
      kind: "datasource"
      key: string
      card: DatasourceResourceCard
    }
  | {
      kind: "web"
      key: string
      part: UIFirecrawlSearchToolCallPart | UIPerplexityToolCallPart
    }

const SOURCE_LABELS = {
  en: ["source", "sources"],
  es: ["fuente", "fuentes"],
  ca: ["font", "fonts"],
  fr: ["source", "sources"],
  it: ["fonte", "fonti"],
  de: ["Quelle", "Quellen"],
  da: ["kilde", "kilder"],
  sv: ["källa", "källor"],
  no: ["kilde", "kilder"],
  pt: ["fonte", "fontes"],
} as const

export type AggregatedSourceResultsProps = {
  parts: SourceToolPart[]
  locale?: string | null
  maxVisible?: number
  className?: string
  getResourceDownloadUrl?: GetResourceDownloadUrlFn
}

export function isCompletedSourceToolPart(
  part: UIMessagePart,
): part is SourceToolPart {
  return (
    part.type === "tool-call" &&
    part.state === "completed" &&
    (part.toolType === "datasource" ||
      part.toolType === "perplexity" ||
      part.toolType === "firecrawl_search")
  )
}

function getDatasourceResources(
  part: UIDatasourceToolCallPart,
): ResourceReadModel[] {
  const resources = part.metadata?.resources
  return Array.isArray(resources) ? resources.filter(isDatasourceResource) : []
}

function getAggregatedCards(
  parts: SourceToolPart[],
  locale?: string | null,
  getResourceDownloadUrl?: GetResourceDownloadUrlFn,
): AggregatedSourceCard[] {
  const datasourceCards = parts
    .filter(
      (part): part is UIDatasourceToolCallPart =>
        part.toolType === "datasource",
    )
    .flatMap((part) =>
      getDatasourceResourceCards(
        getDatasourceResources(part),
        locale,
        getResourceDownloadUrl,
      ).map((card) => ({
        kind: "datasource" as const,
        key: `${part.id}-${card.key}`,
        card,
      })),
    )
  const webCards = parts
    .filter(
      (
        part,
      ): part is UIFirecrawlSearchToolCallPart | UIPerplexityToolCallPart =>
        part.toolType === "perplexity" || part.toolType === "firecrawl_search",
    )
    .map((part) => ({
      kind: "web" as const,
      key: part.id,
      part,
    }))

  return [...datasourceCards, ...webCards]
}

function SourceCard({
  source,
  variant = "card",
}: {
  source: AggregatedSourceCard
  variant?: "card" | "list"
}) {
  if (source.kind === "datasource") {
    return <DatasourceResourceCardView card={source.card} variant={variant} />
  }

  if (variant === "card") {
    return <ToolResultWebSearchCard part={source.part} />
  }

  return (
    <section className="rounded-lg bg-neutral-100 p-4">
      <header className="mb-4 flex items-center gap-3">
        <Globe className="h-5 w-5 shrink-0" aria-hidden="true" />
        <h3 className="text-sm font-medium">Internet search results</h3>
      </header>
      <ToolResultWebSearchResults part={source.part} />
    </section>
  )
}

function getTotalSourceCount(cards: AggregatedSourceCard[]) {
  return cards.reduce(
    (count, source) =>
      count +
      (source.kind === "web" ? getWebSearchResults(source.part).length : 1),
    0,
  )
}

export function AggregatedSourceResults({
  parts,
  locale,
  maxVisible = 3,
  className,
  getResourceDownloadUrl,
}: AggregatedSourceResultsProps) {
  const cards = getAggregatedCards(parts, locale, getResourceDownloadUrl)
  if (cards.length === 0) return null

  const visibleLimit =
    Number.isFinite(maxVisible) && maxVisible >= 1 ? Math.floor(maxVisible) : 3
  const visibleCards = cards.slice(0, visibleLimit)
  const overflowCount = cards.length - visibleCards.length
  const totalSourceCount = getTotalSourceCount(cards)
  const [singularSource, pluralSources] =
    SOURCE_LABELS[getSupportedToolLocale(locale)]
  const overflowLabel = overflowCount === 1 ? singularSource : pluralSources
  const totalLabel = totalSourceCount === 1 ? singularSource : pluralSources

  return (
    <section
      aria-label={pluralSources}
      className={joinClasses("flex flex-wrap gap-3", className)}
    >
      {visibleCards.map((source) => (
        <SourceCard key={source.key} source={source} />
      ))}

      {overflowCount > 0 ? (
        <Sheet>
          <SheetTrigger
            aria-label={`+${overflowCount} ${overflowLabel}`}
            className="flex min-h-[183px] w-[186px] max-w-full flex-col justify-center rounded-lg bg-neutral-100 p-4 text-left font-normal text-neutral-950 transition-colors hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            <span className="text-2xl font-medium leading-7">
              +{overflowCount}
            </span>
            <span className="mt-2 text-sm leading-5">{overflowLabel}</span>
          </SheetTrigger>

          <SheetContent closeLabel="Close">
            <SheetHeader className="pr-10">
              <SheetTitle>
                {totalSourceCount} {totalLabel}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-5 space-y-3">
              {cards.map((source) => (
                <SourceCard
                  key={`sheet-${source.key}`}
                  source={source}
                  variant="list"
                />
              ))}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </section>
  )
}
