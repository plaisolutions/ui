import type { FolderReadModel, ResourceReadModel } from "@plaisolutions/client"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DatasourceToolResources, ToolResultCard } from "../components"

const folder: FolderReadModel = {
  id: "folder-course",
  name: "Programa en Diseño Elearning e Innovación",
  parent_id: null,
  datasource_id: "datasource-course",
  extra_info: {
    type: "COURSE",
    description: "En este curso aprenderás los principios básicos de diseño.",
    opengraph: {
      translations: {
        es: {
          type: "CURSO",
          title: "Programa localizado",
          description: "Descripción localizada de la carpeta.",
          image: "https://example.com/folder-es.png",
          url: "https://example.com/folder-es",
        },
      },
    },
  },
  created_at: "2026-07-01T10:00:00Z",
  updated_at: "2026-07-01T10:00:00Z",
  parent: null,
}

function createResource(
  overrides: Partial<ResourceReadModel> &
    Pick<ResourceReadModel, "id" | "name">,
): ResourceReadModel {
  return {
    type: "SCORM",
    status: "DONE",
    url: null,
    content: null,
    metadata: {},
    extra_info: {},
    folder,
    datasource: {
      id: "datasource-course",
      name: "Courses",
      description: "Course resources",
      summary: null,
      type: "UNSTRUCTURED",
      source: "MANUAL",
      metadata_schema: null,
      created_at: "2026-07-01T10:00:00Z",
      updated_at: "2026-07-01T10:00:00Z",
    },
    external_url: null,
    external_resource_id: null,
    store: true,
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:00:00Z",
    ...overrides,
    id: overrides.id,
    name: overrides.name,
  }
}

describe("DatasourceToolResources", () => {
  it("does not expose a stored resource URL and delegates signed URL resolution", () => {
    const getResourceDownloadUrl = vi.fn()
    const resource = createResource({
      id: "private-resource",
      name: "Private guide",
      type: "PDF",
      folder: null,
      url: "https://storage.googleapis.com/private-bucket/guide.pdf",
    })

    render(
      <DatasourceToolResources
        resources={[resource]}
        getResourceDownloadUrl={getResourceDownloadUrl}
      />,
    )

    expect(screen.queryByRole("link")).toBeNull()
    expect(
      screen.getByRole("button", { name: "PDF Private guide" }),
    ).toBeTruthy()
    expect(document.body.innerHTML).not.toContain(
      "https://storage.googleapis.com/private-bucket/guide.pdf",
    )
  })

  it("keeps external and Google Drive resource URLs as direct links", () => {
    const driveDatasource = createResource({
      id: "unused",
      name: "unused",
    }).datasource
    if (!driveDatasource) throw new Error("Expected a datasource fixture.")

    const resources = [
      createResource({
        id: "external-resource",
        name: "External guide",
        type: "PDF",
        folder: null,
        url: "https://storage.googleapis.com/private-bucket/guide.pdf",
        external_url: "https://example.com/public-guide.pdf",
      }),
      createResource({
        id: "drive-resource",
        name: "Drive guide",
        type: "PDF",
        folder: null,
        url: "https://drive.google.com/file/d/file-id/view",
        datasource: {
          ...driveDatasource,
          source: "GOOGLE_DRIVE",
        },
      }),
    ]

    render(<DatasourceToolResources resources={resources} />)

    expect(
      screen
        .getByRole("link", { name: "PDF External guide" })
        .getAttribute("href"),
    ).toBe("https://example.com/public-guide.pdf")
    expect(
      screen
        .getByRole("link", { name: "PDF Drive guide" })
        .getAttribute("href"),
    ).toBe("https://drive.google.com/file/d/file-id/view")
  })

  it.each([1, 3])(
    "keeps each of %i ungrouped resource cards at the standard card width",
    (resourceCount) => {
      const resources = Array.from({ length: resourceCount }, (_, index) =>
        createResource({
          id: `resource-${index + 1}`,
          name: `Resource ${index + 1}`,
          folder: null,
          url: `https://example.com/resource-${index + 1}.pdf`,
          store: false,
        }),
      )

      const view = render(<DatasourceToolResources resources={resources} />)

      const cards = within(view.container).getAllByRole("link")
      expect(cards).toHaveLength(resourceCount)
      for (const card of cards) {
        expect(card.className).toContain("w-[186px]")
        expect(card.className).toContain("max-w-full")
        expect(card.className).not.toMatch(/(?:^|\s)w-full(?:\s|$)/)
      }
    },
  )

  it("groups folder resources in a card and lists them in a sheet", () => {
    const firstResource = createResource({
      id: "resource-1",
      name: "15. Conceptos clave de Storyline 360",
      external_url: "https://example.com/resource-1",
      extra_info: {
        opengraph: {
          translations: {
            es: {
              type: "LECCIÓN",
              title: "Conceptos localizados",
              description: "Descripción localizada del recurso.",
              image: "https://example.com/resource-es.png",
              url: "https://example.com/resource-es",
            },
          },
        },
      },
    })
    const secondResource = createResource({
      id: "resource-2",
      name: "18. Componentes básicos de Storyline 360",
      external_url: "https://example.com/resource-2",
    })
    const ungroupedResource = createResource({
      id: "resource-3",
      name: "Guía independiente",
      type: "PDF",
      folder: null,
      url: "https://example.com/guide.pdf",
      store: false,
    })

    render(
      <ToolResultCard
        locale="es-ES"
        part={{
          type: "tool-call",
          id: "tool-datasource",
          name: "search_courses",
          toolType: "datasource",
          input: { query: "Storyline" },
          state: "completed",
          result: { count: 3 },
          metadata: {
            documents_metadata: [],
            chunk_ids: null,
            relevance_scores: null,
            resources: [firstResource, secondResource, ungroupedResource],
          },
        }}
      />,
    )

    const trigger = screen.getByRole("button", {
      name: "CURSO: Programa localizado",
    })
    expect(trigger.className).toContain("w-[186px]")
    expect(trigger.className).toContain("max-w-full")
    expect(screen.getByText("2 Recursos")).toBeTruthy()
    const ungroupedCard = screen.getByRole("link", {
      name: "PDF Guía independiente",
    })
    expect(ungroupedCard.className).toContain("w-[186px]")
    expect(ungroupedCard.className).toContain("max-w-full")
    expect(screen.queryByRole("dialog")).toBeNull()

    fireEvent.click(trigger)

    const sheet = screen.getByRole("dialog", {
      name: "Programa localizado",
    })
    expect(sheet.getAttribute("data-state")).toBe("open")
    const sheetQueries = within(sheet)
    expect(sheetQueries.getByText("Ver")).toBeTruthy()
    expect(
      sheetQueries.getByRole("link", {
        name: "LECCIÓN Conceptos localizados Descripción localizada del recurso.",
      }),
    ).toBeTruthy()
    expect(
      sheetQueries.getByRole("link", {
        name: "LECCIÓN Conceptos localizados Descripción localizada del recurso.",
      }).className,
    ).toContain("w-full")
    expect(
      sheetQueries.getByRole("link", { name: "View" }).getAttribute("href"),
    ).toBe("https://example.com/folder-es")
    expect(
      sheetQueries.getByRole("link", {
        name: "SCORM 18. Componentes básicos de Storyline 360",
      }),
    ).toBeTruthy()
    expect(document.body.style.overflow).toBe("hidden")

    fireEvent(sheet, new Event("cancel", { cancelable: true }))

    expect(sheet.getAttribute("data-state")).toBe("closed")
    expect(screen.queryByRole("dialog")).toBe(sheet)
    expect(document.body.style.overflow).toBe("hidden")

    const sheetPanel = sheet.querySelector('[data-slot="sheet-content"]')
    fireEvent.animationEnd(sheetPanel as Element, {
      animationName: "plai-sheet-content-out",
    })

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.body.style.overflow).toBe("")
    expect(document.activeElement).toBe(trigger)
  })
})
