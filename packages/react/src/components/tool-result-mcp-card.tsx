import type { UIMcpToolCallPart } from "@plaisolutions/client"
import { CheckCircle2, Plug, XCircle } from "lucide-react"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"

export type ToolResultMcpCardProps = {
  part: UIMcpToolCallPart
  className?: string
}

function text(value: unknown) {
  if (typeof value === "string") return value
  if (value == null) return null
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return null
  }
}

export function ToolResultMcpCard({ part, className }: ToolResultMcpCardProps) {
  const meta = part.metadata
  const server = meta?.mcp_server_url ?? meta?.server_name
  const tool = meta?.mcp_tool_name ?? meta?.tool_name ?? part.name
  const result = text(part.result)
  const error = formatToolErrorDetails(part.errorDetails)
  const failed = part.state === "error"
  return (
    <Sheet>
      <SheetTrigger
        aria-label={`MCP tool: ${tool}`}
        className={joinClasses(
          "w-full rounded-lg border border-neutral-200 bg-white text-left font-normal text-neutral-950 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950",
          className,
        )}
      >
        <span className="flex items-center gap-2 px-3 py-2 text-sm">
          <Plug
            className="h-4 w-4 shrink-0 text-neutral-500"
            aria-hidden="true"
          />
          <span className="truncate font-medium">MCP</span>
          <span className="min-w-0 truncate text-neutral-600">{tool}</span>
          <span
            className={joinClasses(
              "ml-auto shrink-0",
              failed ? "text-rose-600" : "text-emerald-600",
            )}
          >
            {failed ? (
              <XCircle className="h-4 w-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        </span>
      </SheetTrigger>
      <SheetContent closeLabel="Close">
        <SheetHeader className="pr-10">
          <SheetTitle>MCP tool</SheetTitle>
        </SheetHeader>
        <section className="mt-6 space-y-4" aria-label="MCP tool result">
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-xs text-neutral-500">Tool</dt>
              <dd>{tool}</dd>
            </div>
            {server ? (
              <div>
                <dt className="text-xs text-neutral-500">Server</dt>
                <dd className="break-all">{server}</dd>
              </div>
            ) : null}
          </dl>
          {result ? (
            <div>
              <h3 className="mb-2 text-sm font-medium">Result</h3>
              <pre className="overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs leading-5">
                {result}
              </pre>
            </div>
          ) : null}
          {error ? (
            <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <span className="font-semibold">Error details:</span> {error}
            </p>
          ) : null}
        </section>
      </SheetContent>
    </Sheet>
  )
}
