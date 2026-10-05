import type { ButtonHTMLAttributes } from "react"
import { Loader } from "../icons/loader"
import { Microphone } from "../icons/microphone"
import { X } from "../icons/x"
import { joinClasses } from "../internal/join-classes"
import { getUiCopy } from "../internal/ui-copy"
import { PromptFormIconButton } from "../prompt-form/prompt-form"
import type { TranscribeAudioFn } from "./transcribe-audio"
import {
  type SpeechToTextController,
  useSpeechToText,
} from "./use-speech-to-text"

type SpeechToTextToggleCommonProps = {
  locale?: string | null
  label?: string
  listeningLabel?: string
  cancelLabel?: string
  requestingLabel?: string
  loadingLabel?: string
  cancelOnClickWhileRecording?: boolean
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onToggle">

type StandaloneSpeechToTextToggleProps = {
  controller?: never
  transcribe: TranscribeAudioFn
  onTranscriptionComplete: (text: string) => void
  onTranscriptionError?: (error: Error) => void
}

type ControlledSpeechToTextToggleProps = {
  controller: SpeechToTextController
  transcribe?: never
  onTranscriptionComplete?: never
  onTranscriptionError?: never
}

export type SpeechToTextToggleProps = SpeechToTextToggleCommonProps &
  (StandaloneSpeechToTextToggleProps | ControlledSpeechToTextToggleProps)

async function missingTranscribe(): Promise<string> {
  throw new Error(
    "SpeechToTextToggle requires transcribe when no controller is provided.",
  )
}

export function SpeechToTextToggle({
  controller,
  onTranscriptionComplete,
  onTranscriptionError,
  transcribe,
  locale,
  disabled = false,
  label,
  listeningLabel,
  cancelLabel,
  requestingLabel,
  loadingLabel,
  cancelOnClickWhileRecording = false,
  className,
  onClick,
  ...props
}: SpeechToTextToggleProps) {
  const copy = getUiCopy(locale)
  const internalController = useSpeechToText({
    transcribe: transcribe ?? missingTranscribe,
    onTranscriptionComplete,
    onTranscriptionError,
  })
  const speechToText = controller ?? internalController
  const isRequesting = speechToText.status === "requesting"
  const isListening = speechToText.status === "recording"
  const isTranscribing = speechToText.status === "transcribing"
  const cancelsRecording = isListening && cancelOnClickWhileRecording

  const ariaLabel = isRequesting
    ? (requestingLabel ?? copy.requestingMicrophoneAccess)
    : isTranscribing
      ? (loadingLabel ?? copy.transcribing)
      : cancelsRecording
        ? (cancelLabel ?? copy.cancelRecording)
        : isListening
          ? (listeningLabel ?? copy.stopRecording)
          : (label ?? copy.voiceInput)

  return (
    <PromptFormIconButton
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isListening}
      aria-busy={isRequesting || isTranscribing}
      disabled={disabled || isRequesting || isTranscribing}
      className={joinClasses(
        isListening && !isTranscribing ? "text-red-600" : undefined,
        className,
      )}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) {
          return
        }

        if (cancelsRecording) {
          speechToText.cancel()
          return
        }

        void speechToText.toggle()
      }}
      {...props}
    >
      {isRequesting || isTranscribing ? (
        <Loader className="size-4 animate-spin" />
      ) : cancelsRecording ? (
        <X className="size-4" />
      ) : (
        <Microphone className="size-4" />
      )}
    </PromptFormIconButton>
  )
}
