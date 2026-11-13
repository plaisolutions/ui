import type { UIMessage } from "@plaisolutions/client"
import { AssistantMessage } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"
import type { ReactNode } from "react"

const meta: Meta<typeof AssistantMessage> = {
  title: "Components/Message/GeneratedFileLinks",
  component: AssistantMessage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The model often links the files it generates with paths that only exist in its sandbox (`sandbox:/mnt/data/chart.png`). `MessageParts` points them to the generated file of the message, or removes the link when no file matches. The text below goes through a minimal markdown renderer, which is what the host app's own renderer would receive.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-2xl rounded-2xl bg-slate-100 p-6">
        <Story />
      </div>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof AssistantMessage>

const chartSvg = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="160" viewBox="0 0 360 160"><rect width="360" height="160" fill="#f8fafc"/><rect x="30" y="70" width="50" height="70" fill="#6366f1"/><rect x="110" y="30" width="50" height="110" fill="#6366f1"/><rect x="190" y="90" width="50" height="50" fill="#6366f1"/><rect x="270" y="50" width="50" height="90" fill="#6366f1"/></svg>`,
)

const chartFile = {
  id: "mf_chart",
  name: "valor_inventario_por_categoria.png",
  content_type: "image/png",
  url: `data:image/svg+xml,${chartSvg}`,
}

const codeExecution = {
  type: "tool-call" as const,
  id: "tool_code_links",
  name: "analyze_inventory",
  toolType: "code_execution" as const,
  input: { prompt: "Plot the inventory value by category" },
  state: "completed" as const,
  result: "Status: success",
  metadata: {
    type: "code_execution" as const,
    status: "success" as const,
    media_files: [chartFile],
  },
}

/** Just enough markdown for the story: images, links and paragraphs. */
function renderMarkdown(text: string): ReactNode {
  return text.split("\n").map((line, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: static story content
    <p key={index} className="text-sm leading-6">
      {line.split(/(!?\[[^\]]*\]\([^)]*\))/).map((chunk, chunkIndex) => {
        const match = /^(!?)\[([^\]]*)\]\(([^)]*)\)$/.exec(chunk)
        if (!match) return chunk
        const [, bang, label, url] = match
        return bang ? (
          <img
            // biome-ignore lint/suspicious/noArrayIndexKey: static story content
            key={chunkIndex}
            src={url}
            alt={label}
            className="my-2 max-h-40 rounded-md border border-slate-200"
          />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static story content
          <a key={chunkIndex} href={url} className="text-indigo-600 underline">
            {label}
          </a>
        )
      })}
    </p>
  ))
}

function assistant(text: string, resolveFileLinks = true) {
  const message: UIMessage = {
    id: "message_links",
    role: "assistant",
    parts: [codeExecution, { type: "text", text }],
  }
  return (
    <AssistantMessage
      message={message}
      messagePartsProps={{
        resolveFileLinks,
        renderText: (part) => renderMarkdown(part.text),
      }}
    />
  )
}

export const ResolvedImage: Story = {
  render: () =>
    assistant(
      "Here is the inventory value by category:\n![Gráfico](sandbox:/mnt/data/valor_inventario_por_categoria.png)\n[Descargar el gráfico](sandbox:/mnt/data/valor_inventario_por_categoria.png)",
    ),
}

export const LinkWithoutFile: Story = {
  render: () =>
    assistant(
      "I also prepared a spreadsheet: [Descargar el informe](sandbox:/mnt/data/informe.xlsx), but it was not generated, so only the text stays.",
    ),
}

export const Disabled: Story = {
  render: () =>
    assistant(
      "With `resolveFileLinks={false}` the text reaches the renderer as the model wrote it:\n![Gráfico](sandbox:/mnt/data/valor_inventario_por_categoria.png)",
      false,
    ),
}
