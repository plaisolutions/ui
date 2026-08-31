import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Reload } from "../components"

afterEach(cleanup)

describe("Reload", () => {
  it("forwards clicks with an accessible default label", () => {
    const onClick = vi.fn()
    render(<Reload onClick={onClick} />)

    fireEvent.click(screen.getByRole("button", { name: "Retry response" }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it("supports a custom label and disabled state", () => {
    const onClick = vi.fn()
    render(<Reload label="Reintentar" disabled onClick={onClick} />)

    const button = screen.getByRole("button", { name: "Reintentar" })
    fireEvent.click(button)

    expect(onClick).not.toHaveBeenCalled()
  })
})
