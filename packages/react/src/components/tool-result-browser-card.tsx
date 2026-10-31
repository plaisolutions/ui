import type { UIBrowserToolCallPart } from "@plaisolutions/client"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe,
  LoaderCircle,
  XCircle,
} from "lucide-react"
import { useState } from "react"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"
import { getUiCopy } from "./internal/ui-copy"

export type ToolResultBrowserCardProps = {
  part: UIBrowserToolCallPart
  className?: string
  locale?: string | null
}

const SCRAPER_LABELS = {
  beautifulsoup: "BeautifulSoup",
  firecrawl: "Firecrawl",
  scraperapi: "ScraperAPI",
} as const

function getUrl(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null
  const url = (input as Record<string, unknown>).url
  return typeof url === "string" && url.trim() ? url : null
}

function toOutput(value: unknown) {
  if (typeof value === "string") return value
  if (value == null) return null

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return null
  }
}

function getPreview(output: string | null) {
  if (!output) return null
  return output.length > 200 ? `${output.slice(0, 200)}…` : output
}

export function ToolResultBrowserCard({
  part,
  className,
  locale,
}: ToolResultBrowserCardProps) {
  const copy = getUiCopy(locale)
  const [expanded, setExpanded] = useState(false)
  const metadata = part.metadata
  const output = toOutput(part.result)
  const preview = getPreview(output)
  const url = getUrl(part.input)
  const error = formatToolErrorDetails(part.errorDetails)
  const scraperLabel = metadata?.scraper_type
    ? SCRAPER_LABELS[metadata.scraper_type]
    : null
  const subtitle = scraperLabel
  const failed = part.state === "error"
  const pending = part.state === "pending"
  const canExpand = Boolean(preview || error || url)

  return (
    <section
      className={joinClasses(
        "plai-tool-result-browser-card overflow-hidden rounded-lg border border-border bg-surface",
        className,
      )}
      aria-label={copy.browserResult}
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-secondary">
        <button
          type="button"
          disabled={!canExpand}
          aria-label={
            expanded ? copy.collapseBrowserResult : copy.expandBrowserResult
          }
          aria-expanded={canExpand ? expanded : undefined}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors enabled:cursor-pointer enabled:hover:bg-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          onClick={() => setExpanded((value) => !value)}
        >
          <Globe className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="font-medium text-strong">{copy.browser}</span>
          {subtitle ? (
            <span className="min-w-0 truncate border-border-strong border px-2 py-0.5 rounded-md text-xs text-muted">
              {subtitle}
            </span>
          ) : null}
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {pending ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin text-warning"
                aria-label={copy.pending}
              />
            ) : failed ? (
              <XCircle className="h-4 w-4 text-danger" aria-hidden="true" />
            ) : (
              <CheckCircle2
                className="h-4 w-4 text-success"
                aria-hidden="true"
              />
            )}
            {canExpand ? (
              expanded ? (
                <ChevronUp className="h-4 w-4 text-muted" aria-hidden="true" />
              ) : (
                <ChevronDown
                  className="h-4 w-4 text-muted"
                  aria-hidden="true"
                />
              )
            ) : null}
          </span>
        </button>
      </header>
      {expanded ? (
        <div className="space-y-3 border-t border-border bg-surface-muted p-3">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="block truncate text-xs text-info-strong underline underline-offset-2 hover:text-info-strong"
            >
              {url}
            </a>
          ) : null}
          {preview ? (
            <p className="whitespace-pre-wrap text-xs leading-5 text-secondary">
              {preview}
            </p>
          ) : null}
          {error ? (
            <p className="text-xs text-danger-strong">
              <span className="font-semibold">{copy.errorDetails}:</span>{" "}
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
