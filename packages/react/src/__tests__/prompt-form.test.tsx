import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PromptForm } from "../components"

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

    expect(onSubmit).toHaveBeenCalledWith({ text: "hola" })
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
})
