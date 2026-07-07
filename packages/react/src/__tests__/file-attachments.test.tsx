import { describe, expect, it } from "vitest"
import {
  isAllowedPromptFormFile,
  partitionPromptFormFiles,
} from "../components/prompt-form/file-attachments"

describe("prompt form file attachments", () => {
  it("accepts supported image and document extensions", () => {
    expect(
      isAllowedPromptFormFile(
        new File(["a"], "doggy.jpeg", { type: "image/jpeg" }),
      ),
    ).toBe(true)
    expect(
      isAllowedPromptFormFile(
        new File(["a"], "report.pdf", { type: "application/pdf" }),
      ),
    ).toBe(true)
    expect(
      isAllowedPromptFormFile(
        new File(["a"], "sheet.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      ),
    ).toBe(true)
  })

  it("rejects unsupported files", () => {
    const files = [
      new File(["a"], "notes.pdf", { type: "application/pdf" }),
      new File(["a"], "script.exe", { type: "application/octet-stream" }),
    ]

    const { validFiles, invalidFiles } = partitionPromptFormFiles(files)

    expect(validFiles).toHaveLength(1)
    expect(invalidFiles).toHaveLength(1)
    expect(invalidFiles[0]?.file.name).toBe("script.exe")
  })
})
