import { useCallback, useRef } from "react"

export function useVoiceRecording() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const stopTracks = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop()
    }
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)

    streamRef.current = stream
    chunksRef.current = []
    mediaRecorderRef.current = recorder

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    })

    recorder.start()
  }, [])

  const stop = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === "inactive") {
      throw new Error("No active voice recording")
    }

    const audio = await new Promise<Blob>((resolve, reject) => {
      recorder.addEventListener(
        "stop",
        () => {
          stopTracks()
          mediaRecorderRef.current = null
          resolve(
            new Blob(chunksRef.current, {
              type: recorder.mimeType || "audio/webm",
            }),
          )
        },
        { once: true },
      )
      recorder.addEventListener(
        "error",
        () => {
          stopTracks()
          mediaRecorderRef.current = null
          reject(new Error("Failed to stop voice recording"))
        },
        { once: true },
      )
      recorder.stop()
    })

    chunksRef.current = []
    return audio
  }, [stopTracks])

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
    }
    stopTracks()
    mediaRecorderRef.current = null
    chunksRef.current = []
  }, [stopTracks])

  return { start, stop, cancel }
}
