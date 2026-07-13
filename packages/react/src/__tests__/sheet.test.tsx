import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components"

describe("Sheet", () => {
  it("supports its compound API, modal behavior, and animated dismissal", () => {
    const view = render(
      <Sheet>
        <SheetTrigger>Open settings</SheetTrigger>
        <SheetContent showCloseButton={false}>
          <SheetHeader>
            <SheetTitle>Account settings</SheetTitle>
            <SheetDescription>
              Update your account preferences.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <SheetClose>Done</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>,
    )

    const trigger = screen.getByRole("button", { name: "Open settings" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")

    fireEvent.click(trigger)

    const sheet = screen.getByRole("dialog", { name: "Account settings" })
    const title = screen.getByRole("heading", { name: "Account settings" })
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(sheet.hasAttribute("open")).toBe(true)
    expect(sheet.getAttribute("aria-describedby")).toBe(
      screen.getByText("Update your account preferences.").id,
    )
    expect(document.activeElement).toBe(title)
    expect(document.body.style.overflow).toBe("hidden")

    fireEvent.click(title)
    expect(sheet.getAttribute("data-state")).toBe("open")

    fireEvent.click(screen.getByRole("button", { name: "Done" }))

    expect(sheet.getAttribute("data-state")).toBe("closed")
    expect(screen.queryByRole("dialog")).toBe(sheet)
    const closingPanel = sheet.querySelector('[data-slot="sheet-content"]')
    expect(closingPanel).toBeTruthy()
    fireEvent.animationEnd(closingPanel as Element, {
      animationName: "plai-sheet-content-out",
    })

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.body.style.overflow).toBe("")
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    const reopenedSheet = screen.getByRole("dialog", {
      name: "Account settings",
    })
    fireEvent.click(reopenedSheet)

    expect(reopenedSheet.getAttribute("data-state")).toBe("closed")
    const outsideClickPanel = reopenedSheet.querySelector(
      '[data-slot="sheet-content"]',
    )
    fireEvent.animationEnd(outsideClickPanel as Element, {
      animationName: "plai-sheet-content-out",
    })
    expect(screen.queryByRole("dialog")).toBeNull()

    view.unmount()
  })
})
