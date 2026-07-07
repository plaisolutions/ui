const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
])

export const PROMPT_FORM_FILE_ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"

export type InvalidPromptFormFile = {
  file: File
  reason: string
}

function getFileExtension(filename: string): string | undefined {
  const lastDotIndex = filename.lastIndexOf(".")
  if (lastDotIndex <= 0 || lastDotIndex === filename.length - 1) {
    return undefined
  }

  return filename.slice(lastDotIndex).toLowerCase()
}

export function isAllowedPromptFormFile(file: File): boolean {
  const extension = getFileExtension(file.name)
  if (extension && ALLOWED_EXTENSIONS.has(extension)) {
    return true
  }

  return file.type.startsWith("image/")
}

export function partitionPromptFormFiles(files: File[]): {
  validFiles: File[]
  invalidFiles: InvalidPromptFormFile[]
} {
  const validFiles: File[] = []
  const invalidFiles: InvalidPromptFormFile[] = []

  for (const file of files) {
    if (isAllowedPromptFormFile(file)) {
      validFiles.push(file)
      continue
    }

    invalidFiles.push({
      file,
      reason: `File type is not supported for "${file.name}".`,
    })
  }

  return { validFiles, invalidFiles }
}
