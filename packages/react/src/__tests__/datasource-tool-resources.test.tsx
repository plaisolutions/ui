import type { FolderReadModel, ResourceReadModel } from "@plaisolutions/client"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ToolResultCard } from "../components"

const folder: FolderReadModel = {
  id: "folder-course",
  name: "Programa en Diseño Elearning e Innovación",
  parent_id: null,
  datasource_id: "datasource-course",
  extra_info: {
    type: "COURSE",
    description: "En este curso aprenderás los principios básicos de diseño.",
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
  it("groups folder resources in a card and lists them in a sheet", () => {
    const firstResource = createResource({
      id: "resource-1",
      name: "15. Conceptos clave de Storyline 360",
      external_url: "https://example.com/resource-1",
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
    })

    render(
      <ToolResultCard
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
      name: "COURSE: Programa en Diseño Elearning e Innovación",
    })
    expect(screen.getByText("2 Recursos")).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "PDF Guía independiente" }),
    ).toBeTruthy()
    expect(screen.queryByRole("dialog")).toBeNull()

    fireEvent.click(trigger)

    const sheet = screen.getByRole("dialog", {
      name: "Programa en Diseño Elearning e Innovación",
    })
    expect(sheet.getAttribute("data-state")).toBe("open")
    const sheetQueries = within(sheet)
    expect(sheetQueries.getByText("Ver")).toBeTruthy()
    expect(
      sheetQueries.getByRole("link", {
        name: "SCORM 15. Conceptos clave de Storyline 360",
      }),
    ).toBeTruthy()
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
