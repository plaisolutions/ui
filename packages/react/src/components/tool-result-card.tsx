import type {
  OfficeDocumentMediaFile,
  OfficeDocumentsToolMetadata,
  UIToolCallPart,
} from "@plaisolutions/client"
import { joinClasses } from "./internal/join-classes"

export type ToolResultCardProps = {
  part: UIToolCallPart
  className?: string
  detailsOpen?: boolean
}

function formatStatus(status: UIToolCallPart["state"]) {
  if (status === "pending") return "pending"
  if (status === "error") return "error"
  return "completed"
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

  const metadata = part.metadata as OfficeDocumentsToolMetadata
  if (!Array.isArray(metadata.media_files)) {
    return []
  }

  return metadata.media_files.filter(
    (file): file is OfficeDocumentMediaFile =>
      Boolean(file) && typeof file === "object" && typeof file.id === "string",
  )
}

export function ToolResultCard({
  part,
  className,
  detailsOpen = true,
}: ToolResultCardProps) {
  const officeMediaFiles = getOfficeDocumentMediaFiles(part)

  const statusClass =
    part.state === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : part.state === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800"

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
          {formatStatus(part.state)}
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

      {part.errorDetails ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <span className="font-semibold">Error details:</span>{" "}
          {part.errorDetails}
        </p>
      ) : null}
    </section>
  )
}
