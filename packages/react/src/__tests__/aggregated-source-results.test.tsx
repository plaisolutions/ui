import type { ResourceReadModel, UIMessage } from "@plaisolutions/client"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Message, MessageParts } from "../components"

function createResource(
  index: number,
  overrides: Partial<ResourceReadModel> = {},
): ResourceReadModel {
  return {
    id: `resource-${index}`,
    name: `Resource ${index}`,
    type: "PDF",
    status: "DONE",
    url: `https://example.com/resource-${index}.pdf`,
    content: null,
    metadata: {},
    extra_info: {},
    folder: null,
    datasource: {
      id: "datasource-1",
      name: "Knowledge base",
      description: null,
      summary: null,
      type: "UNSTRUCTURED",
      source: "MANUAL",
      metadata_schema: null,
      created_at: "2026-09-14T10:00:00Z",
      updated_at: "2026-09-14T10:00:00Z",
    },
    external_url: null,
    external_resource_id: null,
    store: false,
    created_at: "2026-09-14T10:00:00Z",
    updated_at: "2026-09-14T10:00:00Z",
    ...overrides,
  }
}

function createDatasourceMessage(resources: ResourceReadModel[]): UIMessage {
  return {
    id: "message-1",
    role: "assistant",
    parts: [
      { type: "text", text: "Agent response" },
      {
        type: "tool-call",
        id: "datasource-tool-1",
        name: "search_knowledge_base",
        toolType: "datasource",
        input: { query: "resources" },
        state: "completed",
        result: { count: resources.length },
        metadata: {
          documents_metadata: [],
          chunk_ids: null,
          relevance_scores: null,
          resources,
        },
      },
    ],
  }
}

describe("AggregatedSourceResults", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("passes protected resource resolution through the routed Message API", async () => {
    const replace = vi.fn()
    vi.spyOn(window, "open").mockReturnValue({
      close: vi.fn(),
      closed: false,
      location: { replace },
      opener: window,
    } as unknown as Window)
    const getResourceDownloadUrl = vi
      .fn()
      .mockResolvedValue("https://storage.example.com/signed")
    const view = render(
      <Message
        message={createDatasourceMessage([
          createResource(1, {
            store: true,
            url: "https://storage.googleapis.com/private/resource.pdf",
          }),
        ])}
        getResourceDownloadUrl={getResourceDownloadUrl}
      />,
    )

    fireEvent.click(
      within(view.container).getByRole("button", { name: "PDF Resource 1" }),
    )

    expect(getResourceDownloadUrl).toHaveBeenCalledWith({
      resourceId: "resource-1",
      signal: expect.any(AbortSignal),
    })
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("https://storage.example.com/signed")
    })
  })

  it("shows three cards and a localized overflow card that opens every source", () => {
    const view = render(
      <MessageParts
        locale="es-ES"
        message={createDatasourceMessage(
          Array.from({ length: 4 }, (_, index) => createResource(index + 1)),
        )}
      />,
    )

    expect(within(view.container).getAllByRole("link")).toHaveLength(3)
    const overflow = within(view.container).getByRole("button", {
      name: "+1 fuente",
    })
    expect(overflow.className).toContain("w-[186px]")
    expect(view.container.textContent?.indexOf("Resource 1")).toBeLessThan(
      view.container.textContent?.indexOf("Agent response") ?? -1,
    )

    fireEvent.click(overflow)

    const sheet = screen.getByRole("dialog", { name: "4 fuentes" })
    expect(within(sheet).getAllByRole("link")).toHaveLength(4)
    expect(within(sheet).getByRole("link", { name: /Resource 4/ })).toBeTruthy()
  })

  it("aggregates datasource and web tools into one shared overflow", () => {
    const view = render(
      <MessageParts
        message={{
          id: "message-mixed",
          role: "assistant",
          parts: [
            {
              type: "tool-call",
              id: "datasource-tool",
              name: "search_docs",
              toolType: "datasource",
              input: {},
              state: "completed",
              metadata: {
                documents_metadata: [],
                chunk_ids: null,
                relevance_scores: null,
                resources: [createResource(1), createResource(2)],
              },
            },
            {
              type: "tool-call",
              id: "perplexity-tool",
              name: "search_web",
              toolType: "perplexity",
              input: {},
              state: "completed",
              metadata: {
                type: "perplexity",
                search_results: [
                  {
                    title: "React documentation",
                    url: "https://react.dev",
                  },
                ],
              },
            },
            {
              type: "tool-call",
              id: "firecrawl-tool",
              name: "search_news",
              toolType: "firecrawl_search",
              input: {},
              state: "completed",
              metadata: {
                type: "firecrawl_search",
                search_results: [
                  {
                    title: "PLai news",
                    url: "https://example.com/news",
                  },
                ],
              },
            },
          ],
        }}
      />,
    )

    expect(within(view.container).getAllByRole("link")).toHaveLength(2)
    expect(
      within(view.container).getByRole("button", {
        name: "Web: Internet search results, 1 source",
      }),
    ).toBeTruthy()
    const overflow = within(view.container).getByRole("button", {
      name: "+1 source",
    })

    fireEvent.click(overflow)

    const sheet = screen.getByRole("dialog", { name: "4 sources" })
    expect(within(sheet).getByRole("link", { name: /Resource 1/ })).toBeTruthy()
    expect(
      within(sheet).getByRole("link", { name: "React documentation" }),
    ).toBeTruthy()
    expect(within(sheet).getByRole("link", { name: "PLai news" })).toBeTruthy()
  })

  it("filters private and duplicate resources before calculating overflow", () => {
    const duplicateUrl = "https://example.com/same.pdf"
    const view = render(
      <MessageParts
        message={createDatasourceMessage([
          createResource(1),
          createResource(2, { url: duplicateUrl }),
          createResource(3, { url: duplicateUrl }),
          createResource(4, { extra_info: { public: false } }),
          createResource(5),
        ])}
      />,
    )

    expect(within(view.container).getAllByRole("link")).toHaveLength(3)
    expect(within(view.container).queryByRole("button")).toBeNull()
    expect(view.container.textContent).not.toContain("Resource 3")
    expect(view.container.textContent).not.toContain("Resource 4")
  })

  it("supports the individual layout as a compatibility escape hatch", () => {
    const view = render(
      <MessageParts
        sourceToolResultsLayout="individual"
        message={createDatasourceMessage(
          Array.from({ length: 4 }, (_, index) => createResource(index + 1)),
        )}
      />,
    )

    expect(within(view.container).getAllByRole("link")).toHaveLength(4)
    expect(
      within(view.container).queryByRole("button", { name: "+1 source" }),
    ).toBeNull()
    expect(view.container.textContent?.indexOf("Agent response")).toBeLessThan(
      view.container.textContent?.indexOf("Resource 1") ?? -1,
    )
  })

  it("does not aggregate pending or failed source tools", () => {
    const view = render(
      <MessageParts
        message={{
          id: "message-source-states",
          role: "assistant",
          parts: [
            {
              type: "tool-call",
              id: "pending-source",
              name: "pending_search",
              toolType: "datasource",
              input: {},
              state: "pending",
            },
            {
              type: "tool-call",
              id: "failed-source",
              name: "failed_search",
              toolType: "datasource",
              input: {},
              state: "error",
              errorDetails: "Unavailable",
            },
          ],
        }}
      />,
    )

    expect(within(view.container).getByRole("status")).toBeTruthy()
    expect(
      within(view.container).getByRole("button", {
        name: "Failed to use tool failed_search",
      }),
    ).toBeTruthy()
    expect(within(view.container).queryByLabelText("sources")).toBeNull()
  })
})
