import { ToolResultCodeExecutionCard } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof ToolResultCodeExecutionCard> = {
  title: "Components/ToolResultCodeExecutionCard",
  component: ToolResultCodeExecutionCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta

type Story = StoryObj<typeof ToolResultCodeExecutionCard>

const chart = {
  id: "file_chart",
  name: "sales-by-region.png",
  content_type: "image/png",
  url: "https://example.com/sales-by-region.png",
}

const report = {
  id: "file_csv",
  name: "sales-summary.csv",
  content_type: "text/csv",
  url: "https://example.com/sales-summary.csv",
}

const steps = [
  {
    kind: "file_view" as const,
    input: "/mnt/data/sales.csv",
    output: "region,month,revenue\nNorth,2026-01,12400\nSouth,2026-01,9800",
    exit_code: null,
  },
  {
    kind: "command" as const,
    input: "python analyze.py --input /mnt/data/sales.csv",
    output: "Loaded 1,204 rows\nWrote sales-summary.csv",
    exit_code: 0,
  },
  {
    kind: "file_create" as const,
    input: "/mnt/data/plot.py",
    output: "File created successfully",
    exit_code: null,
  },
  {
    kind: "file_edit" as const,
    input: "/mnt/data/plot.py",
    output: "File edited successfully",
    exit_code: null,
  },
  {
    kind: "command" as const,
    input: "python plot.py",
    output:
      "Traceback (most recent call last):\n  File \"plot.py\", line 4, in <module>\n    import seaborn\nModuleNotFoundError: No module named 'seaborn'",
    exit_code: 1,
  },
]

export const Completed: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_code_completed",
      name: "analyze_sales",
      toolType: "code_execution",
      input: { prompt: "Summarize sales by region and plot them" },
      state: "completed",
      result: "Status: success\nSummary: Analyzed 1,204 rows.\nFiles: 2",
      metadata: {
        type: "code_execution",
        status: "success",
        media_files: [chart, report],
        sandbox_seconds: 12.4,
        executions: 2,
      },
    },
  },
}

export const WithSteps: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_code_steps",
      name: "analyze_sales",
      toolType: "code_execution",
      input: { prompt: "Summarize sales by region and plot them" },
      state: "completed",
      result: "Status: success",
      metadata: {
        type: "code_execution",
        status: "success",
        media_files: [chart, report],
        steps: steps.slice(0, 4),
        steps_omitted: 0,
      },
    },
  },
}

export const WithOmittedSteps: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_code_omitted",
      name: "analyze_sales",
      toolType: "code_execution",
      input: { prompt: "Clean the dataset and build the report" },
      state: "completed",
      result: "Status: success",
      metadata: {
        type: "code_execution",
        status: "success",
        media_files: [report],
        steps: steps.slice(0, 4),
        steps_omitted: 7,
      },
    },
  },
}

export const Partial: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_code_partial",
      name: "analyze_sales",
      toolType: "code_execution",
      input: { prompt: "Summarize sales by region and plot them" },
      state: "completed",
      result: "Status: partial\nSummary: The chart could not be drawn.",
      metadata: {
        type: "code_execution",
        status: "partial",
        media_files: [report],
        steps,
      },
    },
  },
}

export const Pending: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_code_pending",
      name: "analyze_sales",
      toolType: "code_execution",
      input: { prompt: "Summarize sales by region and plot them" },
      state: "pending",
    },
  },
}

export const Error: Story = {
  args: {
    part: {
      type: "tool-call",
      id: "tool_code_error",
      name: "analyze_sales",
      toolType: "code_execution",
      input: { prompt: "Summarize sales by region and plot them" },
      state: "error",
      errorDetails: {
        error_type: "SandboxError",
        error_code: "sandbox_timeout",
        error_message: "The sandbox ran out of time before finishing.",
      },
      metadata: {
        type: "code_execution",
        status: "error",
        media_files: [],
        error_details: {
          error_type: "SandboxError",
          error_code: "sandbox_timeout",
          error_message: "The sandbox ran out of time before finishing.",
        },
      },
    },
  },
}
