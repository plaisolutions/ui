import type { UIWorkflowDispatchToolCallPart } from "@plaisolutions/client"
import { CheckCircle2, Workflow, XCircle } from "lucide-react"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"
import { getUiCopy, getUiStatusLabel } from "./internal/ui-copy"
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
  locale?: string | null
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
  locale,
}: ToolResultWorkflowDispatchCardProps) {
  const copy = getUiCopy(locale)
  const result = parseResult(part.result)
  const workflowName = result.workflowName ?? part.name
  const status = getUiStatusLabel(result.status ?? part.state, copy)
  const failed = part.state === "error"
  const output = formatResult(part.result)
  const error = formatToolErrorDetails(part.errorDetails)

  return (
    <Sheet>
      <SheetTrigger
        aria-label={`${copy.workflow}: ${workflowName}`}
        className={joinClasses(
          "plai-tool-result-workflow-dispatch-card w-full rounded-lg border border-border bg-surface text-left font-normal text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className,
        )}
      >
        <span className="flex items-center gap-2 px-3 py-2 text-sm">
          <Workflow
            className="h-4 w-4 shrink-0 text-muted"
            aria-hidden="true"
          />
          <span className="shrink-0 font-medium">{copy.workflow}</span>
          <span className="min-w-0 truncate border-border-strong border px-2 py-0.5 rounded-md text-xs text-muted">
            {workflowName}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted">{status}</span>
            {failed ? (
              <XCircle className="h-4 w-4 text-danger" aria-hidden="true" />
            ) : (
              <CheckCircle2
                className="h-4 w-4 text-success"
                aria-hidden="true"
              />
            )}
          </span>
        </span>
      </SheetTrigger>
      <SheetContent locale={locale}>
        <SheetHeader className="pr-10">
          <SheetTitle>{copy.workflowDispatch}</SheetTitle>
        </SheetHeader>
        <section
          className="mt-6 space-y-4"
          aria-label={copy.workflowDispatchResult}
        >
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted">{copy.workflow}</dt>
              <dd>{workflowName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{copy.status}</dt>
              <dd>{status}</dd>
            </div>
            {result.executionId ? (
              <div>
                <dt className="text-xs text-muted">{copy.executionId}</dt>
                <dd className="break-all">{result.executionId}</dd>
              </div>
            ) : null}
            {result.workflowId ? (
              <div>
                <dt className="text-xs text-muted">{copy.workflowId}</dt>
                <dd className="break-all">{result.workflowId}</dd>
              </div>
            ) : null}
          </dl>
          {output ? (
            <div>
              <h3 className="mb-2 text-sm font-medium">{copy.result}</h3>
              <pre className="overflow-x-auto rounded-md border border-border bg-surface-muted p-3 text-xs leading-5">
                {output}
              </pre>
            </div>
          ) : null}
          {error ? (
            <p className="rounded border border-danger-border bg-danger-subtle px-3 py-2 text-xs text-danger-strong">
              <span className="font-semibold">{copy.errorDetails}:</span>{" "}
              {error}
            </p>
          ) : null}
        </section>
      </SheetContent>
    </Sheet>
  )
}
