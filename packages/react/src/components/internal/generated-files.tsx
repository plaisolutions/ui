import { File } from "lucide-react"
import { getFileExtension, getFileIconClass } from "./file-display"
import { FileDownloadButton } from "./file-download-button"
import { joinClasses } from "./join-classes"
import type { UiCopy } from "./ui-copy"

/** The fields of a tool-generated media file that the cards read. */
export type GeneratedFile = {
  id: string
  name?: string
  content_type?: string
  url?: string
  pathname?: string
}

/** Keeps the entries of `metadata.media_files` that look like a media file. */
export function getGeneratedFiles<T extends GeneratedFile>(
  files: unknown,
): T[] {
  return Array.isArray(files)
    ? files.filter(
        (file): file is T =>
          Boolean(file) &&
          typeof file === "object" &&
          typeof file.id === "string",
      )
    : []
}

export function getGeneratedFileExtension(file: GeneratedFile) {
  return getFileExtension(file.name ?? file.pathname, file.content_type)
}

export function getGeneratedFileLabel(file: GeneratedFile) {
  return file.name ?? file.pathname ?? file.id
}

/** A generated file with its extension and a download button, for a sheet. */
export function GeneratedFileRow({
  file,
  copy,
}: {
  file: GeneratedFile
  copy: UiCopy
}) {
  const extension = getGeneratedFileExtension(file)
  const label = getGeneratedFileLabel(file)
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <File
        className={joinClasses("h-8 w-8 shrink-0", getFileIconClass(extension))}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        {extension ? (
          <p className="text-[11px] uppercase text-muted">{extension}</p>
        ) : null}
      </div>
      {file.url ? (
        <FileDownloadButton
          file={{ url: file.url, name: file.name }}
          label={label}
          copy={copy}
        />
      ) : null}
    </div>
  )
}
