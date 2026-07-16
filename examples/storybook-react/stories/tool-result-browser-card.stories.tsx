import { ToolResultBrowserCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ToolResultBrowserCard> = {
  title: "Components/ToolResultBrowserCard",
  component: ToolResultBrowserCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta

type Story = StoryObj<typeof ToolResultBrowserCard>

export const Scraped: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_browser_story",
      name: "Browser",
      toolType: "browser",
      input: { url: "https://example.com" },
      state: "completed",
      result:
        "Example Domain\n\nThis domain is for use in illustrative examples in documents.",
      metadata: {
        type: "browser",
        scraper_type: "firecrawl",
        firecrawl_credits: 1,
      },
    },
  },
}
