import { Globe } from "lucide-react"
import type {
  UIFirecrawlSearchToolCallPart,
  UIPerplexityToolCallPart,
  WebSearchResult,
} from "@plaisolutions/client"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"

export type ToolResultWebSearchCardProps = {
  part: UIPerplexityToolCallPart | UIFirecrawlSearchToolCallPart
  className?: string
}

function isWebSearchResult(value: unknown): value is WebSearchResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return typeof candidate.title === "string" && typeof candidate.url === "string"
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function getLegacyCitationResults(metadata: Record<string, unknown>) {
  if (!Array.isArray(metadata.citations)) {
    return []
  }

  return metadata.citations
    .filter((citation): citation is string => typeof citation === "string")
    .map((url) => ({
      title: getHostname(url) ?? url,
      url,
    }))
}

function getSearchResults(
  part: ToolResultWebSearchCardProps["part"],
): WebSearchResult[] {
  const searchResults = part.metadata?.search_results
  if (Array.isArray(searchResults)) {
    const results = searchResults.filter(isWebSearchResult)
    if (results.length > 0) {
      return results
    }
  }

  return getLegacyCitationResults(part.metadata ?? {})
}

function getFaviconUrl(url: string) {
  const hostname = getHostname(url)
  return hostname
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`
    : null
}

function WebSearchResultItem({ result }: { result: WebSearchResult }) {
  const hostname = getHostname(result.url)
  const source = toStringOrNull(result.source)
  const snippet = toStringOrNull(result.snippet)
  const date = toStringOrNull(result.date) ?? toStringOrNull(result.last_updated)
  const imageUrl = toStringOrNull(result.image_url)
  const faviconUrl = getFaviconUrl(result.url)

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-300 bg-white text-neutral-600"
        >
          <Globe className="h-4 w-4" />
          {faviconUrl ? (
            <img
              src={faviconUrl}
              alt=""
              width="16"
              height="16"
              className="absolute h-4 w-4 bg-white"
              onError={(event) => {
                event.currentTarget.style.display = "none"
              }}
            />
          ) : null}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer noopener"
            className="block line-clamp-2 text-sm font-medium leading-5 text-neutral-950 hover:underline"
          >
            {result.title}
          </a>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            {date ? <span>{date}</span> : null}
            {source ? (
              <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 capitalize text-neutral-600">
                {source}
              </span>
            ) : null}
            {!date && !source && hostname ? <span>{hostname}</span> : null}
          </div>
          {snippet ? (
            <p className="line-clamp-2 text-xs leading-5 text-neutral-600">
              {snippet}
            </p>
          ) : null}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="max-h-64 w-full rounded-md border border-neutral-200 object-contain"
              loading="lazy"
            />
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function ToolResultWebSearchCard({
  part,
  className,
}: ToolResultWebSearchCardProps) {
  const searchResults = getSearchResults(part)
  const errorDetails = formatToolErrorDetails(part.errorDetails)
  const sourceLabel = searchResults.length === 1 ? "source" : "sources"

  return (
    <Sheet>
      <SheetTrigger
        aria-label={`Web: Internet search results, ${searchResults.length} ${sourceLabel}`}
        className={joinClasses(
          "min-h-[183px] w-[186px] rounded-lg bg-neutral-100 p-4 text-left font-normal text-neutral-950 transition-colors hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950",
          className,
        )}
      >
        <header className="flex items-center gap-3">
          <Globe className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-base leading-5">WEB</p>
        </header>
        <h3 className="mt-3 line-clamp-2 text-sm font-normal leading-5">
          Internet search results
        </h3>
        <p className="mt-2 text-xs leading-4 text-neutral-600">
          {part.state === "pending"
            ? "Searching…"
            : `${searchResults.length} ${sourceLabel}`}
        </p>
      </SheetTrigger>

      <SheetContent closeLabel="Close">
        <SheetHeader className="pr-10">
          <SheetTitle>Internet search results</SheetTitle>
        </SheetHeader>

        <section className="mt-5" aria-label="Search results">
          {searchResults.length > 0 ? (
            <div className="space-y-3">
              {searchResults.map((result, index) => (
                <WebSearchResultItem
                  key={`${result.url}-${index}`}
                  result={result}
                />
              ))}
            </div>
          ) : part.state === "pending" ? (
            <p className="text-sm text-neutral-600">Searching for sources…</p>
          ) : (
            <p className="text-sm text-neutral-600">No sources returned.</p>
          )}

          {errorDetails ? (
            <p className="mt-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <span className="font-semibold">Error details:</span> {errorDetails}
            </p>
          ) : null}
        </section>
      </SheetContent>
    </Sheet>
  )
}
