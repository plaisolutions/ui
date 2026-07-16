import type { UIAgentInvocationToolCallPart } from "@plaisolutions/client"
import { Bot, CheckCircle2, LoaderCircle, MessageSquare, XCircle } from "lucide-react"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"

export type ToolResultAgentInvocationCardProps = {
  part: UIAgentInvocationToolCallPart
  className?: string
  onOpenThread?: (threadId: string) => void
}

function formatAgentName(part: UIAgentInvocationToolCallPart) {
  if (part.metadata?.agent_name) return part.metadata.agent_name

  const name = part.name.replace(/^invoke_/, "").replace(/[_-]+/g, " ").trim()
  return name || "Agent"
}

function formatOutput(value: unknown) {
  if (typeof value === "string") return value
  if (value == null) return null

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return null
  }
}

function getPrompt(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const prompt = (value as Record<string, unknown>).input
  return typeof prompt === "string" && prompt.trim() ? prompt : null
}

export function ToolResultAgentInvocationCard({
  part,
  className,
  onOpenThread,
}: ToolResultAgentInvocationCardProps) {
  const metadata = part.metadata
  const agentName = formatAgentName(part)
  const output = formatOutput(part.result)
  const prompt = getPrompt(part.input)
  const error = formatToolErrorDetails(part.errorDetails)
  const threadId = metadata?.thread_id
  const failed = part.state === "error"
  const pending = part.state === "pending"

  return (
    <Sheet>
      <SheetTrigger
        aria-label={`Agent: ${agentName}`}
        className={joinClasses(
          "w-full rounded-lg border border-neutral-200 bg-white text-left font-normal text-neutral-950 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950",
          className,
        )}
      >
        <span className="flex items-center gap-2 px-3 py-2 text-sm">
          <Bot className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
          <span className="shrink-0 font-medium">Agent</span>
          <span className="min-w-0 truncate text-neutral-600">{agentName}</span>
          <span className="ml-auto shrink-0">
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
          </span>
        </span>
      </SheetTrigger>
      <SheetContent closeLabel="Close">
        <SheetHeader className="pr-10">
          <SheetTitle>{agentName}</SheetTitle>
        </SheetHeader>
        <section className="mt-6 space-y-4" aria-label="Agent invocation result">
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-xs text-neutral-500">Status</dt>
              <dd>{part.state}</dd>
            </div>
            {metadata?.agent_id ? (
              <div>
                <dt className="text-xs text-neutral-500">Agent ID</dt>
                <dd className="break-all">{metadata.agent_id}</dd>
              </div>
            ) : null}
            {metadata?.tracked_execution_id ? (
              <div>
                <dt className="text-xs text-neutral-500">Execution ID</dt>
                <dd className="break-all">{metadata.tracked_execution_id}</dd>
              </div>
            ) : null}
          {threadId ? (
            <div>
              <dt className="text-xs text-neutral-500">Thread ID</dt>
              <dd className="break-all">{threadId}</dd>
              </div>
            ) : null}
          </dl>
          {prompt ? (
            <div>
              <h3 className="mb-2 text-sm font-medium">Prompt</h3>
              <p className="whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm leading-6">
                {prompt}
              </p>
            </div>
          ) : null}
          {output ? (
            <div>
              <h3 className="mb-2 text-sm font-medium">Result</h3>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs leading-5">
                {output}
              </pre>
            </div>
          ) : null}
          {threadId && onOpenThread ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
              onClick={() => onOpenThread(threadId)}
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Open conversation
            </button>
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
