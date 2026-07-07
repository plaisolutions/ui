import type { ButtonHTMLAttributes } from "react"
import { useRef } from "react"
import { Paperclip } from "../icons/paperclip"
import {
  PROMPT_FORM_FILE_ACCEPT,
  partitionPromptFormFiles,
} from "./file-attachments"
import type { InvalidPromptFormFile } from "./file-attachments"
import { PromptFormIconButton } from "./prompt-form"

export type PromptFormAttachButtonProps = {
  onFilesSelected: (files: File[]) => void
  onInvalidFiles?: (invalidFiles: InvalidPromptFormFile[]) => void
  accept?: string
  label?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">

export function PromptFormAttachButton({
  onFilesSelected,
  onInvalidFiles,
  accept = PROMPT_FORM_FILE_ACCEPT,
  disabled = false,
  label = "Attach file",
  ...props
}: PromptFormAttachButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(event) => {
          const { validFiles, invalidFiles } = partitionPromptFormFiles(
            Array.from(event.target.files ?? []),
          )

          if (invalidFiles.length > 0) {
            onInvalidFiles?.(invalidFiles)
          }

          if (validFiles.length > 0) {
            onFilesSelected(validFiles)
          }

          event.currentTarget.value = ""
        }}
      />
      <PromptFormIconButton
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        {...props}
      >
        <Paperclip className="size-4" />
      </PromptFormIconButton>
    </>
  )
}
