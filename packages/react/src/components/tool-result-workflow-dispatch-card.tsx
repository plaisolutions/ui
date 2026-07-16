import type { UIWorkflowDispatchToolCallPart } from "@plaisolutions/client"
import { CheckCircle2, Workflow, XCircle } from "lucide-react"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"

export type ToolResultWorkflowDispatchCardProps = {
  part: UIWorkflowDispatchToolCallPart
  className?: string
}

type WorkflowDispatchResult = {
  executionId?: string
  workflowId?: string
  workflowName?: string
  status?: string
}

function parseResult(value: unknown): WorkflowDispatchResult {
  let parsed = value

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value)
    } catch {
      return {}
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {}
  }

  const result = parsed as Record<string, unknown>
  return {
    executionId:
      typeof result.execution_id === "string" ? result.execution_id : undefined,
    workflowId:
      typeof result.workflow_id === "string" ? result.workflow_id : undefined,
    workflowName:
      typeof result.workflow_name_slug === "string"
        ? result.workflow_name_slug
        : undefined,
    status: typeof result.status === "string" ? result.status : undefined,
  }
}

function formatResult(value: unknown) {
  if (typeof value === "string") return value
  if (value == null) return null

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return null
  }
}

export function ToolResultWorkflowDispatchCard({
  part,
  className,
}: ToolResultWorkflowDispatchCardProps) {
  const result = parseResult(part.result)
  const workflowName = result.workflowName ?? part.name
  const status = result.status ?? part.state
  const failed = part.state === "error"
  const output = formatResult(part.result)
  const error = formatToolErrorDetails(part.errorDetails)

  return (
    <Sheet>
      <SheetTrigger
        aria-label={`Workflow: ${workflowName}`}
        className={joinClasses(
          "w-full rounded-lg border border-neutral-200 bg-white text-left font-normal text-neutral-950 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950",
          className,
        )}
      >
        <span className="flex items-center gap-2 px-3 py-2 text-sm">
          <Workflow
            className="h-4 w-4 shrink-0 text-neutral-500"
            aria-hidden="true"
          />
          <span className="shrink-0 font-medium">Workflow</span>
          <span className="min-w-0 truncate text-neutral-600">
            {workflowName}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <span className="text-xs text-neutral-500">{status}</span>
            {failed ? (
              <XCircle className="h-4 w-4 text-rose-600" aria-hidden="true" />
            ) : (
              <CheckCircle2
                className="h-4 w-4 text-emerald-600"
                aria-hidden="true"
              />
            )}
          </span>
        </span>
      </SheetTrigger>
      <SheetContent closeLabel="Close">
        <SheetHeader className="pr-10">
          <SheetTitle>Workflow dispatch</SheetTitle>
        </SheetHeader>
        <section className="mt-6 space-y-4" aria-label="Workflow dispatch result">
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-xs text-neutral-500">Workflow</dt>
              <dd>{workflowName}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Status</dt>
              <dd>{status}</dd>
            </div>
            {result.executionId ? (
              <div>
                <dt className="text-xs text-neutral-500">Execution ID</dt>
                <dd className="break-all">{result.executionId}</dd>
              </div>
            ) : null}
            {result.workflowId ? (
              <div>
                <dt className="text-xs text-neutral-500">Workflow ID</dt>
                <dd className="break-all">{result.workflowId}</dd>
              </div>
            ) : null}
          </dl>
          {output ? (
            <div>
              <h3 className="mb-2 text-sm font-medium">Result</h3>
              <pre className="overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs leading-5">
                {output}
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
