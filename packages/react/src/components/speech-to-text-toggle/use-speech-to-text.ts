import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { TranscribeAudioFn } from "./transcribe-audio"
import { useVoiceRecording } from "./use-voice-recording"

export type SpeechToTextStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "transcribing"

export type UseSpeechToTextOptions = {
  transcribe: TranscribeAudioFn
  onTranscriptionComplete?: (text: string) => void
  onTranscriptionError?: (error: Error) => void
}

export type SpeechToTextController = {
  status: SpeechToTextStatus
  start: () => Promise<void>
  finish: () => Promise<string | null>
  cancel: () => void
  toggle: () => Promise<string | null>
}

function normalizeError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback)
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

/**
 * Owns the complete voice-input lifecycle. `finish` is safe to call from both
 * the microphone control and a form submit: concurrent calls share the same
 * transcription promise.
 */
export function useSpeechToText({
  transcribe,
  onTranscriptionComplete,
  onTranscriptionError,
}: UseSpeechToTextOptions): SpeechToTextController {
  const [status, setStatus] = useState<SpeechToTextStatus>("idle")
  const statusRef = useRef<SpeechToTextStatus>("idle")
  const operationIdRef = useRef(0)
  const pendingFinishRef = useRef<Promise<string | null> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const optionsRef = useRef({
    transcribe,
    onTranscriptionComplete,
    onTranscriptionError,
  })
  optionsRef.current = {
    transcribe,
    onTranscriptionComplete,
    onTranscriptionError,
  }

  const {
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
  } = useVoiceRecording()

  const updateStatus = useCallback((nextStatus: SpeechToTextStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const start = useCallback(async () => {
    if (statusRef.current !== "idle" || pendingFinishRef.current) {
      return
    }

    const operationId = operationIdRef.current + 1
    operationIdRef.current = operationId
    updateStatus("requesting")

    try {
      await startRecording()
      if (operationIdRef.current !== operationId) {
        cancelRecording()
        return
      }
      updateStatus("recording")
    } catch (error) {
      if (operationIdRef.current !== operationId) {
        return
      }
      updateStatus("idle")
      optionsRef.current.onTranscriptionError?.(
        normalizeError(error, "Microphone access was denied"),
      )
    }
  }, [cancelRecording, startRecording, updateStatus])

  const finish = useCallback((): Promise<string | null> => {
    if (pendingFinishRef.current) {
      return pendingFinishRef.current
    }

    if (statusRef.current !== "recording") {
      return Promise.resolve(null)
    }

    const operationId = operationIdRef.current
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    updateStatus("transcribing")

    const pending = (async () => {
      try {
        const audio = await stopRecording()
        if (operationIdRef.current !== operationId) {
          return null
        }

        const transcription = await optionsRef.current.transcribe(
          audio,
          abortController.signal,
        )
        if (operationIdRef.current !== operationId) {
          return null
        }

        const text = transcription.trim()
        if (!text) {
          return null
        }

        optionsRef.current.onTranscriptionComplete?.(text)
        return text
      } catch (error) {
        if (
          operationIdRef.current !== operationId ||
          abortController.signal.aborted ||
          isAbortError(error)
        ) {
          return null
        }

        optionsRef.current.onTranscriptionError?.(
          normalizeError(error, "Transcription failed"),
        )
        return null
      } finally {
        pendingFinishRef.current = null
        abortControllerRef.current = null
        if (operationIdRef.current === operationId) {
          updateStatus("idle")
        }
      }
    })()

    pendingFinishRef.current = pending
    return pending
  }, [stopRecording, updateStatus])

  const cancel = useCallback(() => {
    operationIdRef.current += 1
    abortControllerRef.current?.abort()
    cancelRecording()
    updateStatus("idle")
  }, [cancelRecording, updateStatus])

  const toggle = useCallback(async () => {
    if (statusRef.current === "idle") {
      await start()
      return null
    }

    if (
      statusRef.current === "recording" ||
      statusRef.current === "transcribing"
    ) {
      return finish()
    }

    return null
  }, [finish, start])

  useEffect(() => {
    return () => {
      operationIdRef.current += 1
      abortControllerRef.current?.abort()
      cancelRecording()
    }
  }, [cancelRecording])

  return useMemo(
    () => ({ status, start, finish, cancel, toggle }),
    [cancel, finish, start, status, toggle],
  )
}
