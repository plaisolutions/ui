import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SpeechToTextToggle, useSpeechToText } from "../components"

const start = vi.fn()
const stop = vi.fn()
const cancel = vi.fn()

vi.mock("../components/speech-to-text-toggle/use-voice-recording", () => ({
  useVoiceRecording: () => ({
    start,
    stop,
    cancel,
  }),
}))

afterEach(() => {
  cleanup()
  start.mockReset()
  stop.mockReset()
  cancel.mockReset()
})

describe("SpeechToTextToggle", () => {
  it("starts listening on first click", async () => {
    start.mockResolvedValue(undefined)

    render(
      <SpeechToTextToggle
        transcribe={vi.fn()}
        onTranscriptionComplete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Voice input" }))

    await waitFor(() => {
      expect(start).toHaveBeenCalledTimes(1)
      expect(
        screen.getByRole("button", { name: "Stop recording" }),
      ).toBeTruthy()
    })
  })

  it("calls onTranscriptionComplete after recording stops", async () => {
    const onTranscriptionComplete = vi.fn()
    const transcribe = vi.fn().mockResolvedValue("Hola desde voz")
    start.mockResolvedValue(undefined)
    stop.mockResolvedValue(new Blob(["audio"], { type: "audio/webm" }))

    render(
      <SpeechToTextToggle
        transcribe={transcribe}
        onTranscriptionComplete={onTranscriptionComplete}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Voice input" }))

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Stop recording" }),
      ).toBeTruthy()
    })

    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }))

    await waitFor(() => {
      expect(stop).toHaveBeenCalledTimes(1)
      expect(transcribe).toHaveBeenCalledTimes(1)
      expect(onTranscriptionComplete).toHaveBeenCalledWith("Hola desde voz")
    })
  })

  it("shares the pending transcription when finish is called twice", async () => {
    const transcribe = vi.fn().mockResolvedValue("Hola desde voz")
    start.mockResolvedValue(undefined)
    stop.mockResolvedValue(new Blob(["audio"], { type: "audio/webm" }))

    const { result } = renderHook(() => useSpeechToText({ transcribe }))

    await act(async () => {
      await result.current.start()
    })

    let first: Promise<string | null> | undefined
    let second: Promise<string | null> | undefined
    await act(async () => {
      first = result.current.finish()
      second = result.current.finish()
      expect(second).toBe(first)
      await first
    })

    expect(stop).toHaveBeenCalledTimes(1)
    expect(transcribe).toHaveBeenCalledTimes(1)
    await expect(first).resolves.toBe("Hola desde voz")
  })

  it("can render a cancel action while recording", async () => {
    start.mockResolvedValue(undefined)

    function Example() {
      const controller = useSpeechToText({ transcribe: vi.fn() })
      return (
        <SpeechToTextToggle
          controller={controller}
          cancelOnClickWhileRecording
        />
      )
    }

    render(<Example />)
    fireEvent.click(screen.getByRole("button", { name: "Voice input" }))

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Cancel recording" }),
      ).toBeTruthy()
    })

    fireEvent.click(screen.getByRole("button", { name: "Cancel recording" }))
    expect(cancel).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Voice input" })).toBeTruthy()
    })
  })
})
