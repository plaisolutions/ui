import { CheckCircle2, Globe, XCircle } from "lucide-react"
import type { UIHttpRequestToolCallPart } from "@plaisolutions/client"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./sheet"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"
import { getUiCopy, getUiStatusLabel } from "./internal/ui-copy"

export type ToolResultHttpRequestCardProps = { part: UIHttpRequestToolCallPart; className?: string; locale?: string | null }

function output(value: unknown) {
  if (typeof value === "string") return value
  if (value === undefined || value === null) return null
  try { return JSON.stringify(value, null, 2) } catch { return null }
}

export function ToolResultHttpRequestCard({ part, className, locale }: ToolResultHttpRequestCardProps) {
  const copy = getUiCopy(locale)
  const metadata = part.metadata
  const statusCode = metadata?.status_code
  const failed = part.state === "error" || (typeof statusCode === "number" && statusCode >= 400)
  const response = output(part.result)
  const errorDetails = formatToolErrorDetails(part.errorDetails)
  const status = statusCode ? `${statusCode}${metadata?.status_reason ? ` ${metadata.status_reason}` : ""}` : getUiStatusLabel(part.state, copy)
  return <Sheet>
    <SheetTrigger aria-label={`${copy.httpRequest}: ${status}`} className={joinClasses("w-full rounded-lg border border-neutral-200 bg-white text-left font-normal text-neutral-950 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950", className)}>
      <span className="flex items-center gap-2 px-3 py-2 text-sm"><Globe className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" /><span className="shrink-0 font-medium">{metadata?.method ?? "HTTP"}</span><span className="min-w-0 truncate text-neutral-600">{metadata?.url ?? part.name}</span><span className={joinClasses("ml-auto shrink-0", failed ? "text-rose-600" : "text-emerald-600")}>{failed ? <XCircle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}</span></span>
    </SheetTrigger>
    <SheetContent locale={locale}><SheetHeader className="pr-10"><SheetTitle>{copy.httpRequest}</SheetTitle></SheetHeader><section className="mt-6 space-y-5" aria-label={copy.httpResponse}>
      <dl className="grid gap-2 text-sm"><div><dt className="text-xs text-neutral-500">{copy.status}</dt><dd>{status}</dd></div>{metadata?.url ? <div><dt className="text-xs text-neutral-500">{copy.requestUrl}</dt><dd className="break-all">{metadata.url}</dd></div> : null}{metadata?.response_url && metadata.response_url !== metadata.url ? <div><dt className="text-xs text-neutral-500">{copy.responseUrl}</dt><dd className="break-all">{metadata.response_url}</dd></div> : null}{metadata?.content_type ? <div><dt className="text-xs text-neutral-500">{copy.contentType}</dt><dd>{metadata.content_type}</dd></div> : null}</dl>
      {response ? <div><h3 className="mb-2 text-sm font-medium">{copy.response}</h3><pre className="overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs leading-5">{response}</pre></div> : null}
      {metadata?.response_headers && Object.keys(metadata.response_headers).length ? <details><summary className="cursor-pointer text-sm font-medium">{copy.responseHeaders}</summary><pre className="mt-2 overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs">{JSON.stringify(metadata.response_headers, null, 2)}</pre></details> : null}
      {errorDetails ? <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"><span className="font-semibold">{copy.errorDetails}:</span> {errorDetails}</p> : null}
    </section></SheetContent>
  </Sheet>
}
