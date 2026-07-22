import type { ResourceReadModel } from "@plaisolutions/client"
import { describe, expect, it } from "vitest"
import {
  getLocalizedOpenGraphValue,
  getResourceDescription,
  getResourceIcon,
  getResourceTitle,
  getResourceType,
  getResourceUrl,
} from "../components"

function resourceWithOpenGraph(): ResourceReadModel {
  return {
    id: "resource-og",
    name: "Fallback title",
    type: "WEBPAGE",
    status: "DONE",
    url: "https://example.com/fallback",
    content: "Fallback description",
    metadata: {},
    extra_info: {
      opengraph: {
        title: "Default OG title",
        description: "Default OG description",
        type: "Default type",
        image: "https://example.com/default.png",
        url: "https://example.com/default",
        translations: {
          es: {
            title: "Título en español",
            description: "Descripción en español",
            type: "Artículo",
            image: "https://example.com/es.png",
            url: "https://example.com/es",
          },
          "pt-BR": { title: "Título brasileiro" },
        },
      },
    },
    folder: null,
    datasource: null,
    external_url: "https://example.com/external",
    external_resource_id: null,
    store: true,
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:00:00Z",
  }
}

describe("localized OpenGraph helpers", () => {
  it("matches locale case-insensitively and falls back from region to language", () => {
    const resource = resourceWithOpenGraph()

    expect(getLocalizedOpenGraphValue(resource, "title", "PT-br")).toBe(
      "Título brasileiro",
    )
    expect(getLocalizedOpenGraphValue(resource, "title", "es-MX")).toBe(
      "Título en español",
    )
    expect(getLocalizedOpenGraphValue(resource, "title", "fr-FR")).toBe(
      "Default OG title",
    )
  })

  it("applies OpenGraph before native resource fields", () => {
    const resource = resourceWithOpenGraph()

    expect(getResourceTitle(resource, "es-ES")).toBe("Título en español")
    expect(getResourceDescription(resource, "es-ES")).toBe(
      "Descripción en español",
    )
    expect(getResourceType(resource, "es-ES")).toBe("Artículo")
    expect(getResourceIcon(resource, "es-ES")).toBe(
      "https://example.com/es.png",
    )
    expect(getResourceUrl(resource, "es-ES")).toBe(
      "https://example.com/es",
    )
  })

  it("keeps the legacy resource fallbacks", () => {
    const resource = resourceWithOpenGraph()
    resource.extra_info = {}
    resource.summary = "Resource summary"
    resource.type = ""
    resource.metadata = { type: "article" }

    expect(getResourceDescription(resource, "es-ES")).toBe(
      "Resource summary",
    )
    expect(getResourceType(resource, "es-ES")).toBe("Article")

    resource.metadata = {}
    resource.url = "https://example.com/report.pdf?download=1"
    expect(getResourceType(resource, "es-ES")).toBe("PDF")
  })

  it("prefers the original URL for Google Drive resources", () => {
    const resource = resourceWithOpenGraph()
    resource.extra_info = {}
    resource.url = "https://storage.example.com/generated-download"
    resource.external_url = "https://drive.google.com/file/d/123/view"

    expect(getResourceUrl(resource)).toBe(resource.url)
  })
})
