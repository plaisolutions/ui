export function getFilenameFromUrl(url: string): string | undefined {
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

/** Lowercase extension from the file name, falling back to the MIME type. */
export function getFileExtension(
  name?: string | null,
  contentType?: string | null,
): string | null {
  const label = name ?? ""
  const extension = label.split(".").pop()?.toLowerCase()
  if (extension && extension !== label.toLowerCase()) return extension
  const mime = contentType ?? ""
  if (mime.includes("pdf")) return "pdf"
  if (mime.includes("wordprocessingml")) return "docx"
  if (mime.includes("spreadsheetml")) return "xlsx"
  if (mime.includes("presentationml")) return "pptx"
  if (mime.startsWith("image/")) return mime.slice("image/".length) || null
  return null
}

export function getFileIconClass(extension: string | null) {
  if (extension === "pdf") return "text-rose-500"
  if (["doc", "docx"].includes(extension ?? "")) return "text-blue-600"
  if (["xls", "xlsx", "csv"].includes(extension ?? ""))
    return "text-emerald-600"
  if (["ppt", "pptx"].includes(extension ?? "")) return "text-orange-600"
  return "text-neutral-500"
}
