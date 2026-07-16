import type { UIBrowserToolCallPart } from "@plaisolutions/client"
import { CheckCircle2, Globe, LoaderCircle, Minus, Plus, XCircle } from "lucide-react"
import { useState } from "react"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"

export type ToolResultBrowserCardProps = {
  part: UIBrowserToolCallPart
  className?: string
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
}: ToolResultBrowserCardProps) {
  const [expanded, setExpanded] = useState(false)
  const metadata = part.metadata
  const output = toOutput(part.result)
  const preview = getPreview(output)
  const url = getUrl(part.input)
  const error = formatToolErrorDetails(part.errorDetails)
  const scraperLabel = metadata?.scraper_type
    ? SCRAPER_LABELS[metadata.scraper_type]
    : null
  const credits = metadata?.scraper_api_tokens ?? metadata?.firecrawl_credits
  const creditsLabel =
    typeof credits === "number"
      ? `${credits} credit${credits === 1 ? "" : "s"}`
      : null
  const subtitle = [scraperLabel, creditsLabel].filter(Boolean).join(" · ")
  const failed = part.state === "error"
  const pending = part.state === "pending"
  const canExpand = Boolean(preview || error || url)

  return (
    <section
      className={joinClasses(
        "overflow-hidden rounded-lg border border-neutral-200 bg-white",
        className,
      )}
      aria-label="Browser result"
    >
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <Globe className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
        <span className="font-medium text-neutral-800">Browser</span>
        {subtitle ? (
          <span className="min-w-0 truncate text-xs text-neutral-500">
            {subtitle}
          </span>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {pending ? (
            <LoaderCircle
              className="h-4 w-4 animate-spin text-amber-600"
              aria-label="Pending"
            />
          ) : failed ? (
            <XCircle className="h-4 w-4 text-rose-600" aria-hidden="true" />
          ) : (
            <CheckCircle2
              className="h-4 w-4 text-emerald-600"
              aria-hidden="true"
            />
          )}
          {canExpand ? (
            <button
              type="button"
              aria-label={expanded ? "Collapse browser result" : "Expand browser result"}
              aria-expanded={expanded}
              className="flex h-5 w-5 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? (
                <Minus className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Plus className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
          ) : null}
        </span>
      </div>
      {expanded ? (
        <div className="space-y-3 border-t border-neutral-200 bg-neutral-50 p-3">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="block truncate text-xs text-blue-700 underline underline-offset-2 hover:text-blue-900"
            >
              {url}
            </a>
          ) : null}
          {preview ? (
            <p className="whitespace-pre-wrap text-xs leading-5 text-neutral-600">
              {preview}
            </p>
          ) : null}
          {error ? (
            <p className="text-xs text-rose-700">
              <span className="font-semibold">Error details:</span> {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
