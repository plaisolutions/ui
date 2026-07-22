import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PromptForm } from "../components"

function selectFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files,
  })
  fireEvent.change(input)
}

afterEach(() => {
  cleanup()
})

describe("PromptForm", () => {
  it("submits trimmed text", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onValueChange = vi.fn()

    render(
      <PromptForm
        value="  hola  "
        onValueChange={onValueChange}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    expect(onSubmit).toHaveBeenCalledWith({ text: "hola", files: [] })
  })

  it("renders stop button while streaming", () => {
    const onSubmit = vi.fn()
    const onValueChange = vi.fn()
    const onStop = vi.fn()

    render(
      <PromptForm
        value="hola"
        onValueChange={onValueChange}
        onSubmit={onSubmit}
        status="streaming"
        onStop={onStop}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Stop" }))

    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it("adds selected files and allows removing them", () => {
    const onFilesChange = vi.fn()
    const file = new File(["hello"], "doggy.jpeg", { type: "image/jpeg" })

    const { container } = render(
      <PromptForm
        value=""
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        files={[]}
        onFilesChange={onFilesChange}
      />,
    )

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    selectFiles(input, [file])

    expect(onFilesChange).toHaveBeenCalledWith([file])
  })

  it("submits with files even when text is empty", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const file = new File(["hello"], "notes.pdf", { type: "application/pdf" })

    const { container } = render(
      <PromptForm
        value=""
        onValueChange={vi.fn()}
        onSubmit={onSubmit}
        files={[file]}
      />,
    )

    fireEvent.click(within(container).getByRole("button", { name: "Send" }))

    expect(onSubmit).toHaveBeenCalledWith({ text: "", files: [file] })
  })

  it("reports invalid files", () => {
    const onInvalidFiles = vi.fn()
    const invalidFile = new File(["hello"], "script.exe", {
      type: "application/octet-stream",
    })

    const { container } = render(
      <PromptForm
        value=""
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        onInvalidFiles={onInvalidFiles}
      />,
    )

    const input = within(container).getByLabelText("Attach file")
      .parentElement?.querySelector('input[type="file"]') as HTMLInputElement
    selectFiles(input, [invalidFile])

    expect(onInvalidFiles).toHaveBeenCalledWith([
      expect.objectContaining({ file: invalidFile }),
    ])
  })

  it("submits on Enter and keeps Shift+Enter for a newline", () => {
    const onSubmit = vi.fn()
    render(<PromptForm value="hola" onValueChange={vi.fn()} onSubmit={onSubmit} />)
    const textarea = screen.getByPlaceholderText("Type a message...")

    fireEvent.keyDown(textarea, { key: "Enter" })
    expect(onSubmit).toHaveBeenCalled()

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("renders upload progress and disables file interactions", () => {
    const file = new File(["hello"], "notes.pdf", {
      type: "application/pdf",
    })

    render(
      <PromptForm
        value="Review this"
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        files={[file]}
        uploadState={{
          status: "uploading",
          fileName: "notes.pdf",
          loadedBytes: 40,
          totalBytes: 100,
          progress: 40,
          error: null,
        }}
      />,
    )

    const progress = screen.getByRole("progressbar", { name: "Uploading" })
    expect(progress.getAttribute("aria-valuenow")).toBe("40")
    expect(screen.getByText("Uploading: notes.pdf")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Send" }).hasAttribute("disabled"),
    ).toBe(true)
    expect(
      screen
        .getByRole("button", { name: "Attach file" })
        .hasAttribute("disabled"),
    ).toBe(true)
    expect(
      screen
        .getByRole("button", { name: "Remove file: notes.pdf" })
        .hasAttribute("disabled"),
    ).toBe(true)
  })

  it("renders the processing phase at full progress", () => {
    render(
      <PromptForm
        value=""
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        files={[new File(["hello"], "notes.pdf")]}
        uploadState={{
          status: "processing",
          fileName: "notes.pdf",
          loadedBytes: 5,
          totalBytes: 5,
          progress: 100,
          error: null,
        }}
      />,
    )

    expect(
      screen.getByRole("progressbar", { name: "Processing upload" }),
    ).toBeTruthy()
    expect(screen.getByText("Processing upload: notes.pdf")).toBeTruthy()
  })
})
