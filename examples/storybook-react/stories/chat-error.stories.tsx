import { ChatError } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ChatError> = {
  title: "Components/ChatError",
  component: ChatError,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}
export default meta
type Story = StoryObj<typeof ChatError>

export const SpendingCap: Story = {
  args: {
    locale: "es",
    error: {
      type: "http_error",
      status: 403,
      code: "spending_cap_exceeded",
      message: "Monthly spending cap reached",
      periodEnd: "2026-11-01T00:00:00Z",
    },
  },
}
export const RateLimit: Story = {
  args: {
    locale: "en",
    error: {
      type: "http_error",
      status: 429,
      code: "rate_limit_exceeded",
      message: "Rate limit exceeded",
      retryAfterSeconds: 30,
    },
  },
}
export const AccountingIncomplete: Story = {
  args: {
    locale: "es",
    error: {
      type: "http_error",
      status: 503,
      code: "spending_cap_accounting_incomplete",
      message: "Accounting incomplete",
    },
  },
}
export const Network: Story = {
  args: {
    locale: "en",
    error: { type: "network_error", message: "Failed to fetch" },
  },
}
