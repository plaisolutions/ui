import type { PromptFormProps } from "@plaisolutions/react/components"
import {
  Microphone,
  Paperclip,
  PromptForm,
  PromptFormIconButton,
} from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"

function PromptFormDemo({
  initialValue = "",
  ...props
}: Omit<PromptFormProps, "value" | "onValueChange"> & {
  initialValue?: string
}) {
  const [value, setValue] = useState(initialValue)

  return <PromptForm value={value} onValueChange={setValue} {...props} />
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
      <div className="w-full min-w-[36rem] max-w-4xl">
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

export const Empty: Story = {
  args: {
    initialValue: "",
    rightSlot: (
      <>
        <PromptFormIconButton aria-label="Attach file">
          <Paperclip className="size-4" />
        </PromptFormIconButton>
        <PromptFormIconButton aria-label="Voice input">
          <Microphone className="size-4" />
        </PromptFormIconButton>
      </>
    ),
  },
}

export const WithText: Story = {
  args: {
    initialValue: "Can you summarize this document for me?",
    rightSlot: (
      <>
        <PromptFormIconButton aria-label="Attach file">
          <Paperclip className="size-4" />
        </PromptFormIconButton>
        <PromptFormIconButton aria-label="Voice input">
          <Microphone className="size-4" />
        </PromptFormIconButton>
      </>
    ),
  },
}

export const Streaming: Story = {
  args: {
    initialValue: "What is the weather in Madrid?",
    status: "streaming",
    rightSlot: (
      <>
        <PromptFormIconButton aria-label="Attach file">
          <Paperclip className="size-4" />
        </PromptFormIconButton>
        <PromptFormIconButton aria-label="Voice input">
          <Microphone className="size-4" />
        </PromptFormIconButton>
      </>
    ),
  },
}

export const Submitted: Story = {
  args: {
    initialValue: "Generate a weekly report",
    status: "submitted",
    rightSlot: (
      <>
        <PromptFormIconButton aria-label="Attach file">
          <Paperclip className="size-4" />
        </PromptFormIconButton>
        <PromptFormIconButton aria-label="Voice input">
          <Microphone className="size-4" />
        </PromptFormIconButton>
      </>
    ),
  },
}

export const Disabled: Story = {
  args: {
    initialValue: "This form is disabled",
    disabled: true,
    rightSlot: (
      <>
        <PromptFormIconButton aria-label="Attach file" disabled>
          <Paperclip className="size-4" />
        </PromptFormIconButton>
        <PromptFormIconButton aria-label="Voice input" disabled>
          <Microphone className="size-4" />
        </PromptFormIconButton>
      </>
    ),
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

export const WithSlots: Story = {
  args: {
    initialValue: "Attach a file and send",
    rightSlot: (
      <>
        <PromptFormIconButton aria-label="Attach file">
          <Paperclip className="size-4" />
        </PromptFormIconButton>
        <PromptFormIconButton aria-label="Voice input">
          <Microphone className="size-4" />
        </PromptFormIconButton>
      </>
    ),
  },
}

export const NoClearOnSubmit: Story = {
  args: {
    initialValue: "Keep this text after sending",
    clearOnSubmit: false,
  },
}
