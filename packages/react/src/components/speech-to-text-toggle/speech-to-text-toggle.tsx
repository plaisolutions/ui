import type { ButtonHTMLAttributes } from "react"
import { useRef, useState } from "react"
import { Loader } from "../icons/loader"
import { Microphone } from "../icons/microphone"
import { joinClasses } from "../internal/join-classes"
import { PromptFormIconButton } from "../prompt-form/prompt-form"
import {
  dummyTranscribeAudio,
  transcribeAudioViaEndpoint,
} from "./transcribe-audio"
import type { TranscribeAudioFn } from "./transcribe-audio"
import { useVoiceRecording } from "./use-voice-recording"

export type SpeechToTextToggleProps = {
  onTranscriptionComplete: (text: string) => void
  onTranscriptionError?: (error: Error) => void
  transcribe?: TranscribeAudioFn
  transcriptionEndpoint?: string
  label?: string
  listeningLabel?: string
  loadingLabel?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onToggle">

export function SpeechToTextToggle({
  onTranscriptionComplete,
  onTranscriptionError,
  transcribe,
  transcriptionEndpoint,
  disabled = false,
  label = "Voice input",
  listeningLabel = "Stop recording",
  loadingLabel = "Transcribing...",
  className,
  ...props
}: SpeechToTextToggleProps) {
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { start, stop } = useVoiceRecording()

  const transcribeAudio =
    transcribe ??
    (transcriptionEndpoint
      ? (audio: Blob, signal?: AbortSignal) =>
          transcribeAudioViaEndpoint(audio, transcriptionEndpoint, signal)
      : dummyTranscribeAudio)

  async function handleToggle() {
    if (disabled || isTranscribing) {
      return
    }

    if (!isListening) {
      try {
        await start()
        setIsListening(true)
      } catch (error) {
        onTranscriptionError?.(
          error instanceof Error
            ? error
            : new Error("Microphone access was denied"),
        )
      }
      return
    }

    setIsListening(false)
    setIsTranscribing(true)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const audio = await stop()
      const text = await transcribeAudio(audio, abortController.signal)
      if (text.trim()) {
        onTranscriptionComplete(text)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }

      onTranscriptionError?.(
        error instanceof Error ? error : new Error("Transcription failed"),
      )
    } finally {
      abortControllerRef.current = null
      setIsTranscribing(false)
    }
  }

  const ariaLabel = isTranscribing
    ? loadingLabel
    : isListening
      ? listeningLabel
      : label

  return (
    <PromptFormIconButton
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isListening}
      aria-busy={isTranscribing}
      disabled={disabled || isTranscribing}
      className={joinClasses(
        isListening && !isTranscribing ? "text-red-600" : undefined,
        className,
      )}
      onClick={() => {
        void handleToggle()
      }}
      {...props}
    >
      {isTranscribing ? (
        <Loader className="size-4 animate-spin" />
      ) : (
        <Microphone className="size-4" />
      )}
    </PromptFormIconButton>
  )
}
