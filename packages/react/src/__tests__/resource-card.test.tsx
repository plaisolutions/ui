import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ResourceCard } from "../components"

describe("ResourceCard", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

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

  it("resolves a protected resource URL only when the card is clicked", async () => {
    const replace = vi.fn()
    const popup = {
      close: vi.fn(),
      closed: false,
      location: { replace },
      opener: window,
    } as unknown as Window
    const open = vi.spyOn(window, "open").mockReturnValue(popup)
    const getResourceDownloadUrl = vi
      .fn()
      .mockResolvedValue("https://storage.example.com/signed-resource")

    const view = render(
      <ResourceCard
        type="PDF"
        title="Private handbook"
        description="Internal resource"
        url={null}
        resourceId="resource/private handbook"
        requiresDownloadUrl
        getResourceDownloadUrl={getResourceDownloadUrl}
      />,
    )
    const viewQueries = within(view.container)

    expect(getResourceDownloadUrl).not.toHaveBeenCalled()
    expect(viewQueries.queryByRole("link")).toBeNull()

    fireEvent.click(
      viewQueries.getByRole("button", {
        name: "PDF Private handbook Internal resource",
      }),
    )

    expect(open).toHaveBeenCalledWith("about:blank", "_blank")
    expect(getResourceDownloadUrl).toHaveBeenCalledWith({
      resourceId: "resource/private handbook",
      signal: expect.any(AbortSignal),
    })
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        "https://storage.example.com/signed-resource",
      )
    })
    expect(popup.opener).toBeNull()
  })

  it("shows a retryable error when a protected resource cannot be opened", async () => {
    const replace = vi.fn()
    const close = vi.fn()
    const popup = {
      close,
      closed: false,
      location: { replace },
      opener: window,
    } as unknown as Window
    vi.spyOn(window, "open").mockReturnValue(popup)
    const getResourceDownloadUrl = vi
      .fn()
      .mockRejectedValueOnce(new Error("Access denied"))
      .mockResolvedValueOnce("https://storage.example.com/retry")

    render(
      <ResourceCard
        title="Private handbook"
        url={null}
        resourceId="resource-1"
        requiresDownloadUrl
        getResourceDownloadUrl={getResourceDownloadUrl}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Private handbook" }))
    const error = await screen.findByRole("alert")
    expect(error.textContent).toBe("Unable to open resource. Try again.")
    expect(close).toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Private handbook Unable to open resource. Try again.",
      }),
    )
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("https://storage.example.com/retry")
    })
    expect(getResourceDownloadUrl).toHaveBeenCalledTimes(2)
  })
})
