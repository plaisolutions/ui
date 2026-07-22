export type { TranscribeAudioFn } from "@plaisolutions/client"

const DUMMY_TRANSCRIPTION = "Hello, this is a demo transcription."

export async function dummyTranscribeAudio(
  _audio: Blob,
  signal?: AbortSignal,
): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(resolve, 600)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId)
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
      },
      { once: true },
    )
  })

  return DUMMY_TRANSCRIPTION
}
