import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import {
  dummyTranscribeAudio,
  SpeechToTextToggle,
} from "@plaisolutions/react/components"

function SpeechToTextToggleDemo({ disabled = false }: { disabled?: boolean }) {
  const [transcript, setTranscript] = useState("")

  return (
    <div className="flex flex-col gap-4">
      <SpeechToTextToggle
        disabled={disabled}
        transcribe={dummyTranscribeAudio}
        onTranscriptionComplete={setTranscript}
      />
      <p className="text-sm text-neutral-600">
        Transcript: {transcript || "—"}
      </p>
    </div>
  )
}

const meta: Meta<typeof SpeechToTextToggleDemo> = {
  title: "Components/SpeechToTextToggle",
  component: SpeechToTextToggleDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
}

export default meta

type Story = StoryObj<typeof SpeechToTextToggleDemo>

export const Default: Story = {}

export const Disabled: Story = {
  args: { disabled: true },
}
