import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ToolResultCard } from "../components"

describe("ToolResultWebSearchCard", () => {
  it("opens the Perplexity results from the compact web-search preview", () => {
    const view = render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_perplexity_1",
          name: "perplexity_search",
          toolType: "perplexity",
          input: { query: "React Server Components" },
          state: "completed",
          result: "React Server Components render on the server.",
          metadata: {
            type: "perplexity",
            search_results: [
              {
                title: "Server Components – React",
                url: "https://react.dev/reference/rsc/server-components",
                date: "2026-07-10",
                snippet: "Reference documentation for Server Components.",
              },
            ],
          },
        }}
      />,
    )

    const trigger = screen.getByRole("button", {
      name: "Web: Internet search results, 1 source",
    })
    expect(trigger.className.includes("w-[186px]")).toBe(true)
    expect(within(trigger).getByText("WEB")).toBeTruthy()
    expect(within(trigger).getByText("Internet search results")).toBeTruthy()
    expect(within(trigger).getByText("1 source")).toBeTruthy()

    fireEvent.click(trigger)

    const sheet = screen.getByRole("dialog", {
      name: "Internet search results",
    })
    expect(
      within(sheet).getByRole("link", { name: "Server Components – React" }),
    ).toBeTruthy()
    expect(
      within(sheet).getByText("Reference documentation for Server Components."),
    ).toBeTruthy()
    expect(screen.queryByText("React Server Components render on the server.")).toBeNull()
    view.unmount()
  })

  it("renders Firecrawl source metadata without duplicating its output as a summary", () => {
    const view = render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_firecrawl_1",
          name: "firecrawl_search",
          toolType: "firecrawl_search",
          input: { query: "React news" },
          state: "completed",
          result: "## NEWS RESULTS\n1. React 19\n   https://react.dev/blog",
          metadata: {
            type: "firecrawl_search",
            credits: 1,
            results_count: 1,
            sources: ["news"],
            search_results: [
              {
                source: "news",
                title: "React 19",
                url: "https://react.dev/blog",
                snippet: "The latest React release.",
              },
            ],
          },
        }}
      />,
    )

    const trigger = within(view.container).getByRole("button", {
      name: "Web: Internet search results, 1 source",
    })
    fireEvent.click(trigger)

    const sheet = screen.getByRole("dialog", {
      name: "Internet search results",
    })
    expect(within(sheet).getByText("news")).toBeTruthy()
    expect(within(sheet).queryByText(/## NEWS RESULTS/)).toBeNull()
    view.unmount()
  })

  it("uses legacy citations when persisted metadata has no search_results", () => {
    const view = render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_perplexity_legacy",
          name: "perplexity_search",
          toolType: "perplexity",
          input: { query: "React" },
          state: "completed",
          metadata: {
            type: "perplexity",
            citations: ["https://react.dev/learn"],
          },
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", {
        name: "Web: Internet search results, 1 source",
      }),
    )

    expect(screen.getByRole("link", { name: "react.dev" })).toBeTruthy()
    view.unmount()
  })
})
