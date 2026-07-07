import { describe, expect, it } from "vitest"
import { dummyTranscribeAudio } from "../components/speech-to-text-toggle/transcribe-audio"

describe("dummyTranscribeAudio", () => {
  it("returns a fixed transcription", async () => {
    const text = await dummyTranscribeAudio(new Blob(["audio"]))
    expect(text).toBe("Hello, this is a demo transcription.")
  })
})
