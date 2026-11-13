import {
  CheckCircle2,
  Eye,
  FilePen,
  FilePlus2,
  Terminal,
  TriangleAlert,
  XCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type {
  CodeExecutionMediaFile,
  CodeExecutionStep,
  CodeExecutionStepKind,
  CodeExecutionStatus,
  UICodeExecutionToolCallPart,
} from "@plaisolutions/client"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { GeneratedFileRow, getGeneratedFiles } from "./internal/generated-files"
import { joinClasses } from "./internal/join-classes"
import { getUiCopy, type UiCopy } from "./internal/ui-copy"

export type ToolResultCodeExecutionCardProps = {
  part: UICodeExecutionToolCallPart
  className?: string
  locale?: string | null
}

const STEP_ICONS: Record<CodeExecutionStepKind, LucideIcon> = {
  command: Terminal,
  file_create: FilePlus2,
  file_edit: FilePen,
  file_view: Eye,
}

const STEP_LABELS: Record<CodeExecutionStepKind, keyof UiCopy> = {
  command: "stepCommand",
  file_create: "stepFileCreate",
  file_edit: "stepFileEdit",
  file_view: "stepFileView",
}

function isStepKind(value: unknown): value is CodeExecutionStepKind {
  return typeof value === "string" && value in STEP_ICONS
}

function getSteps(part: UICodeExecutionToolCallPart): CodeExecutionStep[] {
  const steps: unknown = part.metadata?.steps
  if (!Array.isArray(steps)) return []
  return steps.flatMap((step): CodeExecutionStep[] => {
    if (!step || typeof step !== "object" || !isStepKind(step.kind)) return []
    return [
      {
        kind: step.kind,
        input: typeof step.input === "string" ? step.input : "",
        output: typeof step.output === "string" ? step.output : "",
        exit_code: typeof step.exit_code === "number" ? step.exit_code : null,
      },
    ]
  })
}

function getStatus(part: UICodeExecutionToolCallPart): CodeExecutionStatus {
  if (part.state === "error") return "error"
  const status = part.metadata?.status
  return status === "partial" || status === "error" ? status : "success"
}

function getErrorMessage(part: UICodeExecutionToolCallPart) {
  const message = part.metadata?.error_details?.error_message
  if (typeof message === "string" && message.trim()) return message
  return formatToolErrorDetails(part.errorDetails)
}

export function ToolResultCodeExecutionCard({
  part,
  className,
  locale,
}: ToolResultCodeExecutionCardProps) {
  const copy = getUiCopy(locale)
  const files = getGeneratedFiles<CodeExecutionMediaFile>(
    part.metadata?.media_files,
  )
  const steps = getSteps(part)
  const stepsOmitted = part.metadata?.steps_omitted
  const omitted =
    typeof stepsOmitted === "number" && stepsOmitted > 0 ? stepsOmitted : 0
  const pending = part.state === "pending"
  const status = pending ? null : getStatus(part)
  const errorMessage = status === "error" ? getErrorMessage(part) : null
  const fileLabel = files.length === 1 ? copy.file : copy.files

  const summary = pending
    ? copy.pending
    : status === "error"
      ? copy.error
      : status === "partial"
        ? copy.partial
        : files.length > 0
          ? `${files.length} ${fileLabel}`
          : copy.completed

  return (
    <Sheet>
      <SheetTrigger
        aria-label={`${copy.codeExecution}: ${summary}`}
        data-status={status ?? "pending"}
        className={joinClasses(
          "plai-tool-result-code-execution-card w-full overflow-hidden rounded-lg border border-border bg-surface text-left font-normal text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className,
        )}
      >
        <span className="flex items-center gap-2 px-3 py-2 text-sm">
          <Terminal
            className="h-4 w-4 shrink-0 text-muted"
            aria-hidden="true"
          />
          <span className="truncate font-medium">{copy.codeExecution}</span>
          <span className="min-w-0 truncate border-border-strong border px-2 py-0.5 rounded-md text-xs text-muted">
            {summary}
          </span>
          <span
            className={joinClasses(
              "ml-auto shrink-0",
              status === "error"
                ? "text-danger"
                : status === "partial"
                  ? "text-warning"
                  : "text-success",
            )}
          >
            {status === "error" ? (
              <XCircle className="h-4 w-4" aria-hidden="true" />
            ) : status === "partial" ? (
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            ) : status === "success" ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ) : null}
          </span>
        </span>
      </SheetTrigger>
      <SheetContent locale={locale}>
        <SheetHeader className="pr-10">
          <SheetTitle>{copy.codeExecution}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {status === "partial" ? (
            <output className="flex items-center gap-2 rounded border border-warning-border bg-warning-subtle px-3 py-2 text-xs text-warning-strong">
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              {copy.partialResultWarning}
            </output>
          ) : null}
          {errorMessage ? (
            <p
              role="alert"
              className="rounded border border-danger-border bg-danger-subtle px-3 py-2 text-xs text-danger-strong"
            >
              <span className="font-semibold">{copy.errorDetails}:</span>{" "}
              {errorMessage}
            </p>
          ) : null}
          {files.length > 0 || status === "success" ? (
            <section className="space-y-3" aria-label={copy.generatedFiles}>
              {files.map((file) => (
                <GeneratedFileRow key={file.id} file={file} copy={copy} />
              ))}
              {files.length === 0 ? (
                <p className="text-sm text-secondary">
                  {copy.noFilesGenerated}
                </p>
              ) : null}
            </section>
          ) : null}
          {steps.length > 0 ? (
            <section className="space-y-3" aria-label={copy.codeExecutionSteps}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {copy.codeExecutionSteps}
              </h3>
              {omitted > 0 ? (
                <p className="text-xs text-muted">
                  {omitted}{" "}
                  {omitted === 1
                    ? copy.earlierStepNotShown
                    : copy.earlierStepsNotShown}
                </p>
              ) : null}
              <ol className="space-y-2">
                {steps.map((step, index) => (
                  <CodeExecutionStepItem
                    // Steps have no id and keep their order.
                    // biome-ignore lint/suspicious/noArrayIndexKey: static list
                    key={index}
                    step={step}
                    copy={copy}
                  />
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CodeExecutionStepItem({
  step,
  copy,
}: {
  step: CodeExecutionStep
  copy: UiCopy
}) {
  const Icon = STEP_ICONS[step.kind]
  const label = copy[STEP_LABELS[step.kind]]
  const failed = step.exit_code !== null && step.exit_code !== 0

  return (
    <li
      data-step-kind={step.kind}
      data-step-failed={failed ? "true" : undefined}
      className={joinClasses(
        "space-y-2 rounded-lg border bg-surface p-3",
        failed ? "border-danger-border" : "border-border",
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">{label}</span>
        {failed ? (
          <span className="ml-auto rounded border border-danger-border bg-danger-subtle px-2 py-0.5 text-danger-strong">
            {copy.exitCode} {step.exit_code}
          </span>
        ) : null}
      </div>
      {step.input ? (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-muted p-2 font-mono text-xs leading-5">
          {step.input}
        </pre>
      ) : null}
      {step.output ? (
        <pre
          className={joinClasses(
            "max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md p-2 font-mono text-xs leading-5",
            failed
              ? "border border-danger-border bg-danger-subtle text-danger-strong"
              : "bg-inverse text-inverse-foreground",
          )}
        >
          {step.output}
        </pre>
      ) : null}
    </li>
  )
}
