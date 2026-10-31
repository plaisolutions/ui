import type { UIMessage } from "@plaisolutions/client"
import { File, Paperclip } from "lucide-react"
import { useMemo } from "react"
import { FileDownloadButton } from "./internal/file-download-button"
import {
  getFileExtension,
  getFileIconClass,
  getFilenameFromUrl,
} from "./internal/file-display"
import { joinClasses } from "./internal/join-classes"
import { getUiCopy, type UiCopy } from "./internal/ui-copy"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"

export type ConversationFile = {
  /** Media file id when known, otherwise the file URL. */
  id: string
  kind: "uploaded" | "generated"
  name: string
  url: string
  contentType?: string
  extension: string | null
  /** Message the file was attached to or produced in. */
  messageId: string
}

export type ConversationFiles = {
  uploaded: ConversationFile[]
  generated: ConversationFile[]
}

/** URL without query or hash, so a re-signed URL still matches its file. */
function getFileKey(url: string) {
  return url.split("#")[0]?.split("?")[0] ?? url
}

/**
 * Collects the files of the loaded messages, in conversation order: the user's
 * attachments and the files produced by office_documents tool calls. Files
 * without a URL are skipped; a file seen twice is listed once. Persisted
 * history omits media file ids, so files are matched by URL.
 */
export function getConversationFiles(
  messages: readonly UIMessage[],
): ConversationFiles {
  const uploaded: ConversationFile[] = []
  const generated: ConversationFile[] = []
  const seen = new Set<string>()

  const add = (list: ConversationFile[], file: ConversationFile) => {
    const key = `${file.kind}:${getFileKey(file.url)}`
    if (seen.has(key)) return
    seen.add(key)
    list.push(file)
  }

  for (const message of messages) {
    for (const part of message.parts) {
      if (message.role === "user" && part.type === "input_file") {
        // A converted attachment points to the converted copy; list the
        // original the user uploaded when it is known.
        const url =
          (part.metadata?.wasConverted && part.metadata.sourceUrl) ||
          part.fileUrl
        if (!url) continue
        const name =
          part.metadata?.originalFileName ||
          part.title ||
          getFilenameFromUrl(url) ||
          url
        add(uploaded, {
          id: part.metadata?.mediaFileId || url,
          kind: "uploaded",
          name,
          url,
          contentType: part.mimeType,
          extension: getFileExtension(name, part.mimeType),
          messageId: message.id,
        })
      } else if (message.role === "user" && part.type === "input_image") {
        if (!part.url) continue
        const name =
          part.metadata?.originalFileName ||
          part.title ||
          getFilenameFromUrl(part.url) ||
          part.url
        add(uploaded, {
          id: part.metadata?.mediaFileId || part.url,
          kind: "uploaded",
          name,
          url: part.url,
          extension: getFileExtension(name),
          messageId: message.id,
        })
      } else if (
        part.type === "tool-call" &&
        part.toolType === "office_documents"
      ) {
        const mediaFiles = part.metadata?.media_files
        if (!Array.isArray(mediaFiles)) continue
        for (const file of mediaFiles) {
          if (!file || typeof file.id !== "string" || !file.url) continue
          const name = file.name ?? getFilenameFromUrl(file.url) ?? file.id
          add(generated, {
            id: file.id,
            kind: "generated",
            name,
            url: file.url,
            contentType: file.content_type,
            extension: getFileExtension(name, file.content_type),
            messageId: message.id,
          })
        }
      }
    }
  }

  return { uploaded, generated }
}

export type ConversationFilesListProps = {
  messages: readonly UIMessage[]
  locale?: string | null
  className?: string
}

/** Uploaded and generated files of a conversation, each with a download button. */
export function ConversationFilesList({
  messages,
  locale,
  className,
}: ConversationFilesListProps) {
  const copy = getUiCopy(locale)
  const { uploaded, generated } = useMemo(
    () => getConversationFiles(messages),
    [messages],
  )

  return (
    <div className={joinClasses("space-y-6", className)}>
      {uploaded.length === 0 && generated.length === 0 ? (
        <p className="text-sm text-secondary">{copy.noConversationFiles}</p>
      ) : null}
      <FileSection title={copy.uploadedFiles} files={uploaded} copy={copy} />
      <FileSection title={copy.generatedFiles} files={generated} copy={copy} />
    </div>
  )
}

function FileSection({
  title,
  files,
  copy,
}: {
  title: string
  files: ConversationFile[]
  copy: UiCopy
}) {
  if (files.length === 0) return null

  return (
    <section className="space-y-3" aria-label={title}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title} ({files.length})
      </h3>
      {files.map((file) => (
        <div
          key={`${file.kind}:${file.id}`}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
        >
          <File
            className={joinClasses(
              "h-8 w-8 shrink-0",
              getFileIconClass(file.extension),
            )}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            {file.extension ? (
              <p className="text-[11px] uppercase text-muted">
                {file.extension}
              </p>
            ) : null}
          </div>
          <FileDownloadButton
            file={{ url: file.url, name: file.name }}
            label={file.name}
            copy={copy}
          />
        </div>
      ))}
    </section>
  )
}

export type ConversationFilesSheetProps = ConversationFilesListProps & {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Hide the built-in trigger to open the sheet from your own button via `open`. */
  showTrigger?: boolean
  triggerClassName?: string
  side?: "top" | "right" | "bottom" | "left"
}

/** Side sheet with the conversation's files, opened from a paperclip button. */
export function ConversationFilesSheet({
  messages,
  locale,
  className,
  open,
  onOpenChange,
  showTrigger = true,
  triggerClassName,
  side,
}: ConversationFilesSheetProps) {
  const copy = getUiCopy(locale)
  const count = useMemo(() => {
    const { uploaded, generated } = getConversationFiles(messages)
    return uploaded.length + generated.length
  }, [messages])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
        <SheetTrigger
          aria-label={`${copy.conversationFiles}: ${count}`}
          title={copy.conversationFiles}
          className={joinClasses(
            "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-sm text-strong transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            triggerClassName,
          )}
        >
          <Paperclip className="h-4 w-4" aria-hidden="true" />
          {count > 0 ? <span className="tabular-nums">{count}</span> : null}
        </SheetTrigger>
      ) : null}
      <SheetContent locale={locale} side={side}>
        <SheetHeader className="pr-10">
          <SheetTitle>{copy.conversationFiles}</SheetTitle>
        </SheetHeader>
        <ConversationFilesList
          messages={messages}
          locale={locale}
          className={joinClasses("mt-6", className)}
        />
      </SheetContent>
    </Sheet>
  )
}
