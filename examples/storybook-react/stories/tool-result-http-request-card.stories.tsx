import { ToolResultHttpRequestCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ToolResultHttpRequestCard> = {
  title: "Components/ToolResultHttpRequestCard",
  component: ToolResultHttpRequestCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta

type Story = StoryObj<typeof ToolResultHttpRequestCard>

export const Success: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_http_story_success",
      name: "get_weather",
      toolType: "http_request",
      input: { city: "Madrid" },
      state: "completed",
      result: JSON.stringify({ temperature: 28, condition: "sunny" }, null, 2),
      metadata: {
        type: "http_request",
        method: "GET",
        url: "https://api.example.com/weather?city=Madrid",
        status_code: 200,
        status_reason: "OK",
        content_type: "application/json",
        response_headers: { "cache-control": "max-age=60", "x-request-id": "req_123" },
      },
    },
  },
}

export const HttpError: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_http_story_error",
      name: "get_weather",
      toolType: "http_request",
      input: { city: "Unknown" },
      state: "completed",
      result: "404 Client Error: Not Found",
      metadata: {
        type: "http_request",
        method: "GET",
        url: "https://api.example.com/weather?city=Unknown",
        status_code: 404,
        status_reason: "Not Found",
        content_type: "application/json",
      },
    },
  },
}
