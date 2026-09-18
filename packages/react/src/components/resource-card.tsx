import type { GetResourceDownloadUrlFn } from "@plaisolutions/client"
import { File } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { joinClasses } from "./internal/join-classes"

export type ResourceCardProps = {
  icon?: string
  type?: string
  title: string
  description?: string
  url: string | null
  variant?: "card" | "list"
  className?: string
  resourceId?: string
  requiresDownloadUrl?: boolean
  getResourceDownloadUrl?: GetResourceDownloadUrlFn
}

type ResourceCardContentProps = Pick<
  ResourceCardProps,
  "icon" | "type" | "title" | "description"
>

function ResourceCardContent({
  icon,
  type,
  title,
  description,
}: ResourceCardContentProps) {
  const heading = type ?? title
  const bodyTitle = type ? title : description
  const bodyDescription = type ? description : undefined

  return (
    <>
      <header className="flex min-w-0 items-center gap-3">
        {icon ? (
          <img
            src={icon}
            alt=""
            width="20"
            height="20"
            className="h-5 w-5 shrink-0 object-contain"
          />
        ) : (
          <File className="h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <p className="min-w-0 truncate text-base leading-5">{heading}</p>
      </header>
      {bodyTitle ? (
        <p className="mt-2 line-clamp-2 text-sm font-medium leading-5">
          {bodyTitle}
        </p>
      ) : null}
      {bodyDescription ? (
        <p className="mt-2 line-clamp-2 text-xs leading-4 text-neutral-600">
          {bodyDescription}
        </p>
      ) : null}
    </>
  )
}

export function ResourceCard(props: ResourceCardProps) {
  const {
    className: customClassName,
    variant = "card",
    resourceId,
    requiresDownloadUrl = false,
    getResourceDownloadUrl,
    ...contentProps
  } = props
  const [downloadState, setDownloadState] = useState<
    "idle" | "loading" | "error"
  >("idle")
  const abortControllerRef = useRef<AbortController | null>(null)
  const className = joinClasses(
    "block rounded-lg bg-neutral-100 p-4 text-left text-neutral-950",
    variant === "card" ? "min-h-[183px] w-[186px] max-w-full" : "w-full",
    customClassName,
  )
  const interactiveClassName = `${className} transition-colors hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950`

  useEffect(
    () => () => {
      abortControllerRef.current?.abort()
    },
    [],
  )

  const openProtectedResource = useCallback(async () => {
    if (!resourceId || !getResourceDownloadUrl || downloadState === "loading") {
      return
    }

    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setDownloadState("loading")

    const popup = window.open("about:blank", "_blank")
    if (popup) popup.opener = null

    try {
      const downloadUrl = await getResourceDownloadUrl({
        resourceId,
        signal: abortController.signal,
      })
      if (abortController.signal.aborted) {
        popup?.close()
        return
      }
      if (!downloadUrl.trim()) {
        throw new Error("The resource download URL is empty.")
      }

      if (popup && !popup.closed) {
        popup.location.replace(downloadUrl)
      } else {
        const fallbackPopup = window.open(
          downloadUrl,
          "_blank",
          "noopener,noreferrer",
        )
        if (!fallbackPopup) {
          throw new Error("The resource window was blocked.")
        }
      }
      setDownloadState("idle")
    } catch {
      popup?.close()
      if (!abortController.signal.aborted) setDownloadState("error")
    }
  }, [downloadState, getResourceDownloadUrl, resourceId])

  if (requiresDownloadUrl && resourceId && getResourceDownloadUrl) {
    return (
      <button
        type="button"
        className={`${interactiveClassName} border-0 disabled:cursor-wait disabled:opacity-70`}
        onClick={openProtectedResource}
        disabled={downloadState === "loading"}
        aria-busy={downloadState === "loading"}
      >
        <ResourceCardContent {...contentProps} />
        {downloadState === "loading" ? (
          <span
            className="mt-2 block text-xs text-neutral-600"
            aria-live="polite"
          >
            Opening resource…
          </span>
        ) : null}
        {downloadState === "error" ? (
          <span className="mt-2 block text-xs text-red-700" role="alert">
            Unable to open resource. Try again.
          </span>
        ) : null}
      </button>
    )
  }

  if (!contentProps.url) {
    return (
      <article
        aria-label={`${contentProps.title}: ${contentProps.description}`}
        className={className}
      >
        <ResourceCardContent {...contentProps} />
      </article>
    )
  }

  return (
    <a
      href={contentProps.url}
      target="_blank"
      rel="noreferrer noopener"
      className={interactiveClassName}
    >
      <ResourceCardContent {...contentProps} />
    </a>
  )
}
