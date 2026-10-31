import { Download, LoaderCircle } from "lucide-react"
import { useState, type MouseEvent } from "react"
import { downloadFile, type DownloadableFile } from "./download-file"
import { joinClasses } from "./join-classes"
import type { UiCopy } from "./ui-copy"

export type FileDownloadButtonProps = {
  file: DownloadableFile
  label: string
  copy: UiCopy
  className?: string
}

export function FileDownloadButton({
  file,
  label,
  copy,
  className,
}: FileDownloadButtonProps) {
  const [state, setState] = useState<"idle" | "downloading" | "error">("idle")
  const isDownloading = state === "downloading"

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (isDownloading) return
    setState("downloading")
    try {
      await downloadFile(file)
      setState("idle")
    } catch {
      setState("error")
    }
  }

  return (
    <span className="ml-auto flex shrink-0 items-center gap-2">
      {state === "error" ? (
        <span role="alert" className="text-xs text-danger">
          {copy.downloadFailed}
        </span>
      ) : null}
      <button
        type="button"
        onClick={handleClick}
        disabled={isDownloading}
        aria-label={`${isDownloading ? copy.downloading : copy.download}: ${label}`}
        title={isDownloading ? copy.downloading : copy.download}
        className={joinClasses(
          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-strong transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60",
          className,
        )}
      >
        {isDownloading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </span>
  )
}
