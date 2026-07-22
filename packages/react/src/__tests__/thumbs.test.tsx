import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ThumbDown, ThumbUp } from "../components"

afterEach(cleanup)

describe("rating thumb buttons", () => {
  it("forwards clicks from ThumbUp", () => {
    const onClick = vi.fn()
    render(<ThumbUp onClick={onClick} />)

    fireEvent.click(screen.getByRole("button", { name: "Rate positively" }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it("supports labels, disabled state and pressed styling semantics", () => {
    const onClick = vi.fn()
    render(
      <ThumbDown
        label="No me gusta"
        aria-pressed="true"
        disabled
        onClick={onClick}
      />,
    )

    const button = screen.getByRole("button", { name: "No me gusta" })
    expect(button.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
