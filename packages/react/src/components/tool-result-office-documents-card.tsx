import { CheckCircle2, File, FileText, XCircle } from "lucide-react"
import type { OfficeDocumentMediaFile, UIOfficeDocumentsToolCallPart } from "@plaisolutions/client"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"

export type ToolResultOfficeDocumentsCardProps = {
  part: UIOfficeDocumentsToolCallPart
  className?: string
}

function getFiles(part: UIOfficeDocumentsToolCallPart) {
  const files = part.metadata?.media_files
  return Array.isArray(files)
    ? files.filter(
        (file): file is OfficeDocumentMediaFile =>
          Boolean(file) && typeof file === "object" && typeof file.id === "string",
      )
    : []
}

function getExtension(file: OfficeDocumentMediaFile) {
  const name = file.name ?? file.pathname ?? ""
  const extension = name.split(".").pop()?.toLowerCase()
  if (extension && extension !== name.toLowerCase()) return extension
  const mime = file.content_type ?? ""
  if (mime.includes("pdf")) return "pdf"
  if (mime.includes("wordprocessingml")) return "docx"
  if (mime.includes("spreadsheetml")) return "xlsx"
  if (mime.includes("presentationml")) return "pptx"
  return null
}

function iconClass(extension: string | null) {
  if (extension === "pdf") return "text-rose-500"
  if (["doc", "docx"].includes(extension ?? "")) return "text-blue-600"
  if (["xls", "xlsx", "csv"].includes(extension ?? "")) return "text-emerald-600"
  if (["ppt", "pptx"].includes(extension ?? "")) return "text-orange-600"
  return "text-neutral-500"
}

export function ToolResultOfficeDocumentsCard({
  part,
  className,
}: ToolResultOfficeDocumentsCardProps) {
  const files = getFiles(part)
  const errorDetails = formatToolErrorDetails(part.errorDetails)
  const fileLabel = files.length === 1 ? "file" : "files"
  const statusClass =
    part.state === "error"
      ? "text-rose-600"
      : part.state === "pending"
        ? "text-amber-600"
        : "text-emerald-600"

  return (
    <Sheet>
      <SheetTrigger
        aria-label={`Office documents: ${files.length} ${fileLabel}`}
        className={joinClasses(
          "w-full overflow-hidden rounded-lg border border-neutral-200 bg-white text-left font-normal text-neutral-950 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950",
          className,
        )}
      >
        <span className="flex items-center gap-2 px-3 py-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
          <span className="truncate font-medium">Office documents</span>
          <span className="truncate text-xs text-neutral-500">
            {part.state === "pending" ? "pending" : `${files.length} ${fileLabel}`}
          </span>
          <span className={joinClasses("ml-auto shrink-0", statusClass)}>
            {part.state === "error" ? <XCircle className="h-4 w-4" aria-hidden="true" /> : part.state === "completed" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : null}
          </span>
        </span>
      </SheetTrigger>
      <SheetContent closeLabel="Close">
        <SheetHeader className="pr-10"><SheetTitle>Office documents</SheetTitle></SheetHeader>
        <section className="mt-6 space-y-3" aria-label="Generated files">
          {files.map((file) => {
            const extension = getExtension(file)
            const label = file.name ?? file.pathname ?? file.id
            const content = <div key={file.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"><File className={joinClasses("h-8 w-8 shrink-0", iconClass(extension))} aria-hidden="true" /><div className="min-w-0"><p className="truncate text-sm font-medium">{label}</p>{extension ? <p className="text-[11px] uppercase text-neutral-500">{extension}</p> : null}</div></div>
            return file.url ? <a key={file.id} href={file.url} target="_blank" rel="noreferrer noopener" className="block hover:bg-neutral-50">{content}</a> : <div key={file.id}>{content}</div>
          })}
          {files.length === 0 && part.state === "pending" ? <p className="text-sm text-neutral-600">Creating documents…</p> : null}
          {files.length === 0 && part.state === "completed" && !errorDetails ? <p className="text-sm text-neutral-600">No files were generated.</p> : null}
          {errorDetails ? <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"><span className="font-semibold">Error details:</span> {errorDetails}</p> : null}
        </section>
      </SheetContent>
    </Sheet>
  )
}
