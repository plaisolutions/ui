import type {
  OfficeDocumentMediaFile,
  ResourceReadModel,
  UIToolCallPart,
} from "@plaisolutions/client"
import {
  DatasourceToolResources,
  isDatasourceResource,
} from "./datasource-tool-resources"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"
import { ToolResultEmailSendCard } from "./tool-result-email-send-card"
import { ToolResultAgentInvocationCard } from "./tool-result-agent-invocation-card"
import { ToolResultBrowserCard } from "./tool-result-browser-card"
import { ToolResultExternalDatasourceCard } from "./tool-result-external-datasource-card"
import { ToolResultHttpRequestCard } from "./tool-result-http-request-card"
import { ToolResultMcpCard } from "./tool-result-mcp-card"
import { ToolResultOfficeDocumentsCard } from "./tool-result-office-documents-card"
import { ToolResultWebSearchCard } from "./tool-result-web-search-card"
import { ToolResultWorkflowDispatchCard } from "./tool-result-workflow-dispatch-card"

export type ToolResultCardProps = {
  part: UIToolCallPart
  className?: string
  detailsOpen?: boolean
  locale?: string | null
  onOpenAgentThread?: (threadId: string) => void
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function getOfficeDocumentMediaFiles(
  part: UIToolCallPart,
): OfficeDocumentMediaFile[] {
  if (part.toolType !== "office_documents") {
    return []
  }

  if (!part.metadata || typeof part.metadata !== "object") {
    return []
  }

  const metadata = part.metadata
  if (!Array.isArray(metadata.media_files)) {
    return []
  }

  return metadata.media_files.filter(
    (file): file is OfficeDocumentMediaFile =>
      Boolean(file) && typeof file === "object" && typeof file.id === "string",
  )
}

function getDatasourceResources(part: UIToolCallPart): ResourceReadModel[] {
  if (part.toolType !== "datasource" || !part.metadata) {
    return []
  }

  const resources = part.metadata.resources
  return Array.isArray(resources) ? resources.filter(isDatasourceResource) : []
}

export function ToolResultCard({
  part,
  className,
  detailsOpen = true,
  locale,
  onOpenAgentThread,
}: ToolResultCardProps) {
  const officeMediaFiles = getOfficeDocumentMediaFiles(part)
  const datasourceResources = getDatasourceResources(part)
  const errorDetails = formatToolErrorDetails(part.errorDetails)

  if (part.toolType === "email_send") {
    return <ToolResultEmailSendCard part={part} className={className} />
  }

  if (part.toolType === "agent_invocation") {
    return (
      <ToolResultAgentInvocationCard
        part={part}
        className={className}
        onOpenThread={onOpenAgentThread}
      />
    )
  }

  if (part.toolType === "browser") {
    return <ToolResultBrowserCard part={part} className={className} />
  }

  if (part.toolType === "external_datasource") {
    return (
      <ToolResultExternalDatasourceCard part={part} className={className} />
    )
  }

  if (part.toolType === "office_documents") {
    return <ToolResultOfficeDocumentsCard part={part} className={className} />
  }

  if (part.toolType === "http_request") {
    return <ToolResultHttpRequestCard part={part} className={className} />
  }
  if (part.toolType === "mcp_tool") {
    return <ToolResultMcpCard part={part} className={className} />
  }

  if (part.toolType === "workflow_dispatch") {
    return <ToolResultWorkflowDispatchCard part={part} className={className} />
  }

  if (part.toolType === "perplexity" || part.toolType === "firecrawl_search") {
    return <ToolResultWebSearchCard part={part} className={className} />
  }

  if (datasourceResources.length > 0) {
    return (
      <DatasourceToolResources
        resources={datasourceResources}
        locale={locale}
        className={className}
      />
    )
  }

  const statusClass =
    part.state === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : part.state === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800"

  const statusLabel =
    part.state === "pending"
      ? "pending"
      : part.state === "error"
        ? "error"
        : "completed"

  return (
    <section
      className={joinClasses(
        "space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3",
        className,
      )}
      data-tool-call-id={part.id}
      data-tool-call-state={part.state}
    >
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{part.name}</h4>
        <span
          className={joinClasses(
            "rounded-full border px-2 py-0.5 text-xs font-medium",
            statusClass,
          )}
        >
          {statusLabel}
        </span>
      </header>

      {part.toolType ? (
        <p className="text-xs text-slate-600">
          <span className="font-semibold">Type:</span> {part.toolType}
        </p>
      ) : null}

      <details open={detailsOpen} className="space-y-2">
        <summary className="cursor-pointer text-xs font-semibold text-slate-600">
          Input
        </summary>
        <pre className="overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100">
          {formatJson(part.input)}
        </pre>
      </details>

      {part.result !== undefined ? (
        <details open={detailsOpen} className="space-y-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">
            Output
          </summary>
          {officeMediaFiles.length > 0 ? (
            <div className="space-y-2 rounded border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-700">
                Generated files
              </p>
              <ul className="space-y-1">
                {officeMediaFiles.map((file) => {
                  const label = file.name || file.pathname || file.id
                  return (
                    <li key={file.id} className="text-xs text-slate-700">
                      {file.url ? (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="hover:underline"
                        >
                          {label}
                        </a>
                      ) : (
                        <span>{label}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
          <pre className="overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100">
            {formatJson(part.result)}
          </pre>
        </details>
      ) : null}

      {errorDetails ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <span className="font-semibold">Error details:</span> {errorDetails}
        </p>
      ) : null}
    </section>
  )
}
