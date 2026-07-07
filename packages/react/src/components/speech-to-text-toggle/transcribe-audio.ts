export type TranscribeAudioFn = (
  audio: Blob,
  signal?: AbortSignal,
) => Promise<string>

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

export async function transcribeAudioViaEndpoint(
  audio: Blob,
  endpoint: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    body: audio,
    signal,
  })

  if (!response.ok) {
    throw new Error(
      `Transcription request failed with status ${response.status}`,
    )
  }

  const body = (await response.json()) as { text?: string; data?: string }
  const text = body.text ?? body.data

  if (!text) {
    throw new Error("Transcription response did not include text")
  }

  return text
}
