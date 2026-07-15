import { ToolResultWebSearchCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ToolResultWebSearchCard> = {
  title: "Components/ToolResultWebSearchCard",
  component: ToolResultWebSearchCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
}

export default meta

type Story = StoryObj<typeof ToolResultWebSearchCard>

export const Perplexity: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_perplexity_story",
      name: "perplexity_search",
      toolType: "perplexity",
      input: { query: "React Server Components" },
      state: "completed",
      result:
        "React Server Components render on the server and stream the result to the client.\n\nSources:\n(1) https://react.dev/reference/rsc/server-components",
      metadata: {
        type: "perplexity",
        search_results: [
          {
            title: "Server Components – React",
            url: "https://react.dev/reference/rsc/server-components",
            date: "2026-07-10",
            snippet: "Reference documentation for Server Components.",
          },
          {
            title: "React Server Components Architecture",
            url: "https://react.dev/reference/rsc/server-components#how-do-server-components-work",
            snippet: "An overview of how Server Components work.",
          },
        ],
      },
    },
  },
}

export const Firecrawl: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_firecrawl_story",
      name: "firecrawl_search",
      toolType: "firecrawl_search",
      input: { query: "React news" },
      state: "completed",
      result: "## NEWS RESULTS\n1. React 19\n   https://react.dev/blog",
      metadata: {
        type: "firecrawl_search",
        results_count: 1,
        credits: 1,
        sources: ["news"],
        search_results: [
          {
            source: "news",
            title: "React 19",
            url: "https://react.dev/blog/2024/12/05/react-19",
            snippet: "The latest stable release of React.",
          },
        ],
      },
    },
  },
}
