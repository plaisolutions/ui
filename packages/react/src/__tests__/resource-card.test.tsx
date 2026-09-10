import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ResourceCard } from "../components"

describe("ResourceCard", () => {
  it("renders a linked resource with the default Lucide icon", () => {
    const view = render(
      <ResourceCard
        title="SCORM"
        description="Conceptos clave de Storyline 360"
        url="https://example.com/storyline"
      />,
    )

    const link = screen.getByRole("link", {
      name: "SCORM Conceptos clave de Storyline 360",
    })
    expect(link.getAttribute("href")).toBe("https://example.com/storyline")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.className).toContain("min-h-[183px]")
    expect(link.className).toContain("w-[186px]")
    expect(link.className).toContain("max-w-full")
    expect(link.className).not.toMatch(/(?:^|\s)w-full(?:\s|$)/)
    expect(view.container.querySelector("svg")).toBeTruthy()
    expect(view.container.querySelector("img")).toBeNull()
  })

  it("renders a string icon as an image and handles a missing URL", () => {
    const view = render(
      <ResourceCard
        icon="https://example.com/scorm.svg"
        title="SCORM"
        description="Componentes básicos"
        url={null}
        variant="list"
      />,
    )

    const image = view.container.querySelector("img")
    const viewQueries = within(view.container)
    expect(image?.getAttribute("src")).toBe("https://example.com/scorm.svg")
    expect(viewQueries.queryByRole("link")).toBeNull()
    const article = viewQueries.getByRole("article", {
      name: "SCORM: Componentes básicos",
    })
    expect(article.className).toContain("w-full")
    expect(article.className).not.toContain("min-h-[183px]")
  })
})
