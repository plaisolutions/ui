import type {
  UIMessage,
  UIMessagePart,
  UIToolCallPart,
} from "@plaisolutions/client"
import type { HTMLAttributes, ReactNode } from "react"
import { useMemo, useState } from "react"
import { joinClasses } from "./internal/join-classes"
import { ToolResultCard } from "./tool-result-card"

export type MessageProps = HTMLAttributes<HTMLElement> & {
  align?: "start" | "end"
}

export function Message({
  align = "start",
  className,
  ...props
}: MessageProps) {
  return (
    <article
      className={joinClasses(
        "flex w-full items-start gap-3",
        align === "end" ? "flex-row-reverse" : undefined,
        className,
      )}
      data-align={align}
      {...props}
    />
  )
}

export type MessageAvatarProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  src: string
  fallback: string
  alt?: string
  imageClassName?: string
}

function getFallbackInitials(fallback: string) {
  const words = fallback.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

export function MessageAvatar({
  src,
  fallback,
  alt = fallback,
  className,
  imageClassName,
  ...props
}: MessageAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = src.trim().length > 0 && failedSrc !== src
  const initials = getFallbackInitials(fallback)

  return (
    <div
      className={joinClasses(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-xs font-semibold uppercase text-neutral-700",
        className,
      )}
      {...props}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className={joinClasses(
            "size-full rounded-full object-cover",
            imageClassName,
          )}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span role="img" aria-label={alt}>
          {initials}
        </span>
      )}
    </div>
  )
}

export type MessageContentProps = HTMLAttributes<HTMLDivElement>

export function MessageContent({ className, ...props }: MessageContentProps) {
  return (
    <div
      className={joinClasses("min-w-0 max-w-full flex-1 space-y-2", className)}
      {...props}
    />
  )
}

export type MessageHeaderProps = HTMLAttributes<HTMLElement>

export function MessageHeader({ className, ...props }: MessageHeaderProps) {
  return (
    <header
      className={joinClasses(
        "text-xs font-semibold uppercase tracking-wide text-neutral-500",
        className,
      )}
      {...props}
    />
  )
}

export type MessageFooterProps = HTMLAttributes<HTMLElement>

export function MessageFooter({ className, ...props }: MessageFooterProps) {
  return (
    <footer
      className={joinClasses("flex items-center gap-2", className)}
      {...props}
    />
  )
}

export type MessagePartsProps = HTMLAttributes<HTMLDivElement> & {
  message: UIMessage
  collapseThreshold?: number
  datasourceToolResultsPosition?: "inline" | "before-content"
  onOpenAgentThread?: (threadId: string) => void
  locale?: string | null
  renderText?: (
    part: Extract<UIMessagePart, { type: "text" }>,
    context: { message: UIMessage; isStreaming: boolean },
  ) => ReactNode
  renderToolCall?: (
    part: UIToolCallPart,
    context: { message: UIMessage },
  ) => ReactNode
  isStreaming?: boolean
  readMoreLabel?: string
  readLessLabel?: string
}

const DEFAULT_COLLAPSE_THRESHOLD = 600

function getFilenameFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    const pathname = decodeURIComponent(parsed.pathname)
    const basename = pathname.split("/").pop()?.trim()
    return basename || undefined
  } catch {
    const cleanedUrl = url.split("?")[0]?.split("#")[0] ?? ""
    const basename = cleanedUrl.split("/").pop()?.trim()
    return basename || undefined
  }
}

function getDisplayExtension(label?: string) {
  if (!label) return undefined
  const ext = label.split(".").pop()?.trim().toUpperCase()
  if (!ext || ext === label.toUpperCase()) return undefined
  return ext
}

function renderPart(
  part: UIMessagePart,
  index: number,
  message: UIMessage,
  isStreaming: boolean,
  onOpenAgentThread?: (threadId: string) => void,
  locale?: string | null,
  renderText?: MessagePartsProps["renderText"],
  renderToolCall?: MessagePartsProps["renderToolCall"],
) {
  if (part.type === "text") {
    if (renderText) {
      return (
        <div key={`text-${index}`}>
          {renderText(part, { message, isStreaming })}
        </div>
      )
    }
    return (
      <p
        key={`text-${index}`}
        className="whitespace-pre-wrap text-sm leading-6"
      >
        {part.text}
      </p>
    )
  }

  if (part.type === "input_image") {
    const title =
      part.metadata?.originalFileName ||
      part.title ||
      getFilenameFromUrl(part.url)

    return (
      <a
        key={`image-${index}`}
        href={part.url}
        target="_blank"
        rel="noreferrer noopener"
        className="block w-fit rounded-lg border border-slate-200 bg-white p-2"
      >
        <img
          src={part.url}
          alt={title || "Uploaded image"}
          className="max-h-56 rounded-md object-contain"
        />
        {title ? (
          <p className="mt-2 max-w-xs truncate text-xs font-medium text-slate-700">
            {title}
          </p>
        ) : null}
      </a>
    )
  }

  if (part.type === "input_file") {
    const fileName =
      part.metadata?.originalFileName ||
      part.title ||
      getFilenameFromUrl(part.fileUrl) ||
      "Document"
    const extension = getDisplayExtension(fileName)

    return (
      <a
        key={`file-${index}`}
        href={part.fileUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="flex w-fit items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left"
      >
        <span className="rounded bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          {extension ?? "File"}
        </span>
        <div className="min-w-0">
          <p className="max-w-xs truncate text-sm font-medium text-slate-900">
            {fileName}
          </p>
          {part.mimeType ? (
            <p className="text-xs text-slate-500">{part.mimeType}</p>
          ) : null}
        </div>
      </a>
    )
  }

  if (part.type === "tool-call") {
    if (renderToolCall) {
      return (
        <div key={`tool-${part.id}-${index}`}>
          {renderToolCall(part, { message })}
        </div>
      )
    }
    return (
      <ToolResultCard
        key={`tool-${part.id}-${index}`}
        part={part}
        locale={locale}
        onOpenAgentThread={onOpenAgentThread}
      />
    )
  }

  if (part.type === "guardrail") {
    return (
      <p
        key={`guardrail-${index}`}
        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      >
        {part.content}
      </p>
    )
  }

  return null
}

function orderMessageParts(
  parts: UIMessagePart[],
  position: NonNullable<MessagePartsProps["datasourceToolResultsPosition"]>,
) {
  const indexedParts = parts.map((part, index) => ({ part, index }))
  if (position === "inline") return indexedParts

  const datasourceParts: typeof indexedParts = []
  const remainingParts: typeof indexedParts = []
  for (const indexedPart of indexedParts) {
    if (
      indexedPart.part.type === "tool-call" &&
      indexedPart.part.toolType === "datasource"
    ) {
      datasourceParts.push(indexedPart)
    } else {
      remainingParts.push(indexedPart)
    }
  }
  return [...datasourceParts, ...remainingParts]
}

export function MessageParts({
  message,
  collapseThreshold = DEFAULT_COLLAPSE_THRESHOLD,
  datasourceToolResultsPosition = "inline",
  onOpenAgentThread,
  locale,
  renderText,
  renderToolCall,
  isStreaming = false,
  readMoreLabel = "Read more",
  readLessLabel = "Read less",
  className,
  ...props
}: MessagePartsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const textContent = useMemo(
    () =>
      message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n"),
    [message.parts],
  )
  const canCollapse =
    message.role === "user" &&
    message.parts.every((part) => part.type === "text") &&
    textContent.length > collapseThreshold
  const previewText = canCollapse
    ? `${textContent.slice(0, collapseThreshold).trimEnd()}...`
    : textContent
  const orderedParts = useMemo(
    () => orderMessageParts(message.parts, datasourceToolResultsPosition),
    [message.parts, datasourceToolResultsPosition],
  )

  return (
    <div
      className={joinClasses("space-y-2", className)}
      data-message-role={message.role}
      {...props}
    >
      {canCollapse && !isExpanded ? (
        <p className="whitespace-pre-wrap text-sm leading-6">{previewText}</p>
      ) : (
        orderedParts.map(({ part, index }) =>
          renderPart(
            part,
            index,
            message,
            isStreaming,
            onOpenAgentThread,
            locale,
            renderText,
            renderToolCall,
          ),
        )
      )}
      {canCollapse ? (
        <button
          type="button"
          className="text-left text-xs font-medium text-slate-600 hover:text-slate-900"
          onClick={() => setIsExpanded((previous) => !previous)}
        >
          {isExpanded ? readLessLabel : readMoreLabel}
        </button>
      ) : null}
    </div>
  )
}
