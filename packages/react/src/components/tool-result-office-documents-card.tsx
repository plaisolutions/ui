import { CheckCircle2, File, FileText, XCircle } from "lucide-react"
import type {
  OfficeDocumentMediaFile,
  UIOfficeDocumentsToolCallPart,
} from "@plaisolutions/client"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"
import { FileDownloadButton } from "./internal/file-download-button"
import { getFileIconClass } from "./internal/file-display"
import {
  GeneratedFileRow,
  getGeneratedFileExtension,
  getGeneratedFileLabel,
  getGeneratedFiles,
} from "./internal/generated-files"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"
import { getUiCopy } from "./internal/ui-copy"

export type ToolResultOfficeDocumentsCardProps = {
  part: UIOfficeDocumentsToolCallPart
  className?: string
  locale?: string | null
}

function getFiles(part: UIOfficeDocumentsToolCallPart) {
  return getGeneratedFiles<OfficeDocumentMediaFile>(part.metadata?.media_files)
}

function getExtension(file: OfficeDocumentMediaFile) {
  return getGeneratedFileExtension(file)
}

function getLabel(file: OfficeDocumentMediaFile) {
  return getGeneratedFileLabel(file)
}

export function ToolResultOfficeDocumentsCard({
  part,
  className,
  locale,
}: ToolResultOfficeDocumentsCardProps) {
  const copy = getUiCopy(locale)
  const files = getFiles(part)
  const errorDetails = formatToolErrorDetails(part.errorDetails)
  const fileLabel = files.length === 1 ? copy.file : copy.files
  const statusClass =
    part.state === "error"
      ? "text-danger"
      : part.state === "pending"
        ? "text-warning"
        : "text-success"

  const singleFile =
    part.state === "completed" && files.length === 1 && !errorDetails
      ? files[0]
      : undefined

  if (singleFile) {
    const extension = getExtension(singleFile)
    const label = getLabel(singleFile)
    return (
      <section
        aria-label={`${copy.officeDocuments}: ${label}`}
        className={joinClasses(
          "plai-tool-result-office-documents-card flex w-full items-center gap-3 overflow-hidden rounded-lg border border-border bg-surface px-3 py-2 text-left font-normal text-foreground",
          className,
        )}
      >
        <File
          className={joinClasses(
            "h-6 w-6 shrink-0",
            getFileIconClass(extension),
          )}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="truncate text-[11px] text-muted">
            {copy.officeDocuments}
            {extension ? ` · ${extension.toUpperCase()}` : null}
          </p>
        </div>
        {singleFile.url ? (
          <FileDownloadButton
            file={{ url: singleFile.url, name: singleFile.name }}
            label={label}
            copy={copy}
          />
        ) : (
          <CheckCircle2
            className="ml-auto h-4 w-4 shrink-0 text-success"
            aria-hidden="true"
          />
        )}
      </section>
    )
  }

  return (
    <Sheet>
      <SheetTrigger
        aria-label={`${copy.officeDocuments}: ${files.length} ${fileLabel}`}
        className={joinClasses(
          "plai-tool-result-office-documents-card w-full overflow-hidden rounded-lg border border-border bg-surface text-left font-normal text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className,
        )}
      >
        <span className="flex items-center gap-2 px-3 py-2 text-sm">
          <FileText
            className="h-4 w-4 shrink-0 text-muted"
            aria-hidden="true"
          />
          <span className="truncate font-medium">{copy.officeDocuments}</span>
          <span className="min-w-0 truncate border-border-strong border px-2 py-0.5 rounded-md text-xs text-muted">
            {part.state === "pending"
              ? copy.pending
              : `${files.length} ${fileLabel}`}
          </span>
          <span className={joinClasses("ml-auto shrink-0", statusClass)}>
            {part.state === "error" ? (
              <XCircle className="h-4 w-4" aria-hidden="true" />
            ) : part.state === "completed" ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ) : null}
          </span>
        </span>
      </SheetTrigger>
      <SheetContent locale={locale}>
        <SheetHeader className="pr-10">
          <SheetTitle>{copy.officeDocuments}</SheetTitle>
        </SheetHeader>
        <section className="mt-6 space-y-3" aria-label={copy.generatedFiles}>
          {files.map((file) => (
            <GeneratedFileRow key={file.id} file={file} copy={copy} />
          ))}
          {files.length === 0 && part.state === "pending" ? (
            <p className="text-sm text-secondary">{copy.creatingDocuments}</p>
          ) : null}
          {files.length === 0 && part.state === "completed" && !errorDetails ? (
            <p className="text-sm text-secondary">{copy.noFilesGenerated}</p>
          ) : null}
          {errorDetails ? (
            <p className="rounded border border-danger-border bg-danger-subtle px-3 py-2 text-xs text-danger-strong">
              <span className="font-semibold">{copy.errorDetails}:</span>{" "}
              {errorDetails}
            </p>
          ) : null}
        </section>
      </SheetContent>
    </Sheet>
  )
}
