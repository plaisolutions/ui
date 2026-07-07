import type { PromptFormProps } from "@plaisolutions/react/components"
import { PromptForm, SpeechToTextToggle } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"

function PromptFormDemo({
  initialValue = "",
  initialFiles = [],
  ...props
}: Omit<
  PromptFormProps,
  "value" | "onValueChange" | "files" | "onFilesChange" | "rightSlot"
> & {
  initialValue?: string
  initialFiles?: File[]
}) {
  const [value, setValue] = useState(initialValue)
  const [files, setFiles] = useState(initialFiles)

  function handleTranscriptionComplete(text: string) {
    setValue((current) => (current ? `${current} ${text}` : text))
  }

  return (
    <PromptForm
      value={value}
      onValueChange={setValue}
      files={files}
      onFilesChange={setFiles}
      rightSlot={
        <SpeechToTextToggle onTranscriptionComplete={handleTranscriptionComplete} />
      }
      {...props}
    />
  )
}

const meta: Meta<typeof PromptFormDemo> = {
  title: "Components/PromptForm",
  component: PromptFormDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="w-full min-w-xl max-w-4xl">
        <Story />
      </div>
    ),
  ],
  args: {
    onSubmit: async () => {},
    onStop: () => {},
    placeholder: "Envía un mensaje...",
  },
}

export default meta

type Story = StoryObj<typeof PromptFormDemo>

export const Empty: Story = {}

export const WithText: Story = {
  args: {
    initialValue: "Can you summarize this document for me?",
  },
}

export const WithAttachments: Story = {
  args: {
    initialFiles: [new File(["image"], "doggy.jpeg", { type: "image/jpeg" })],
  },
}

export const WithMultipleAttachments: Story = {
  args: {
    initialFiles: [
      new File(["image"], "doggy.jpeg", { type: "image/jpeg" }),
      new File(["pdf"], "report.pdf", { type: "application/pdf" }),
    ],
  },
}

export const Streaming: Story = {
  args: {
    initialValue: "What is the weather in Madrid?",
    status: "streaming",
  },
}

export const Submitted: Story = {
  args: {
    initialValue: "Generate a weekly report",
    status: "submitted",
  },
}

export const Disabled: Story = {
  args: {
    initialValue: "This form is disabled",
    disabled: true,
    initialFiles: [new File(["image"], "doggy.jpeg", { type: "image/jpeg" })],
  },
}

export const CustomLabels: Story = {
  args: {
    initialValue: "",
    placeholder: "Ask anything...",
    sendLabel: "Ask",
    stopLabel: "Cancel",
  },
}
