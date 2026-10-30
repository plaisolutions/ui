import { getFilenameFromUrl } from "./file-display"

export type DownloadableFile = {
  url: string
  name?: string
}

/**
 * Single entry point for downloading a chat file.
 *
 * Fetches the bytes and saves them under the file name, so the browser neither
 * navigates nor opens a tab. That read needs the file host to allow this origin
 * (CORS); when it does not, the URL opens in a new tab instead. An HTTP error
 * (expired, deleted or private object) rejects so the caller can say so.
 */
export async function downloadFile(file: DownloadableFile): Promise<void> {
  let response: Response
  try {
    response = await fetch(file.url, { credentials: "omit" })
  } catch {
    // A cross-origin read the host does not allow surfaces as a network error.
    openInNewTab(file.url)
    return
  }

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`)
  }

  const blob = await response.blob()
  saveBlob(blob, file.name || getFilenameFromUrl(file.url) || "download")
}

function saveBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.rel = "noopener"
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoking right away can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer")
}
