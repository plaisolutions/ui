import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Clipboard } from "../components"

let writeText: ReturnType<typeof vi.fn>

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Clipboard", () => {
  it("copies internally, notifies onCopy, and shows feedback", async () => {
    const onCopy = vi.fn()
    render(<Clipboard text="Hello world" onCopy={onCopy} />)

    fireEvent.click(screen.getByRole("button", { name: "Copy" }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Hello world")
      expect(onCopy).toHaveBeenCalledWith("Hello world")
      expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy()
    })
  })

  it("works without onCopy and supports custom labels and content", async () => {
    render(
      <Clipboard
        text="Hola"
        copyLabel="Copiar mensaje"
        copiedLabel="Mensaje copiado"
      >
        {({ isCopied }) => (isCopied ? "Listo" : "Copiar")}
      </Clipboard>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Copiar mensaje" }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Hola")
      expect(screen.getByText("Listo")).toBeTruthy()
      expect(
        screen.getByRole("button", { name: "Mensaje copiado" }),
      ).toBeTruthy()
    })
  })

  it("does not notify or show feedback when the browser copy fails", async () => {
    writeText.mockRejectedValue(new Error("Copy failed"))
    const onCopy = vi.fn()
    render(<Clipboard text="Hello" onCopy={onCopy} />)

    fireEvent.click(screen.getByRole("button", { name: "Copy" }))

    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(onCopy).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Copied" })).toBeNull()
  })

  it("keeps successful feedback when the optional callback fails", async () => {
    const onCopy = vi.fn().mockRejectedValue(new Error("Tracking failed"))
    render(<Clipboard text="Hello" onCopy={onCopy} />)

    fireEvent.click(screen.getByRole("button", { name: "Copy" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy()
    })
  })
})
