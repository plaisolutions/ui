import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { parseSseStream } from "../sse"
import { streamFromString } from "./test-utils"

const fixturesDir = resolve(process.cwd(), "../../tests/fixtures")

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []
  for await (const item of iterable) {
    items.push(item)
  }
  return items
}

describe("parseSseStream", () => {
  it("parses simple text streams", async () => {
    const raw = readFileSync(resolve(fixturesDir, "simple-text.sse"), "utf8")
    const events = await collect(parseSseStream(streamFromString(raw, 13)))

    expect(events).toHaveLength(8)
    expect(events.at(-1)).toEqual({ type: "message_stop" })
  })

  it("parses tool use and tool result streams", async () => {
    const raw = readFileSync(resolve(fixturesDir, "tool-use.sse"), "utf8")
    const events = await collect(parseSseStream(streamFromString(raw, 9)))

    expect(events.map((event) => event.type)).toEqual([
      "message_start",
      "content_block_start",
      "content_block_stop",
      "tool_result",
      "message_stop",
    ])
  })

  it("parses guardrail stream variants", async () => {
    const inputRaw = readFileSync(
      resolve(fixturesDir, "guardrail-input.sse"),
      "utf8",
    )
    const outputRaw = readFileSync(
      resolve(fixturesDir, "guardrail-output.sse"),
      "utf8",
    )

    const inputEvents = await collect(
      parseSseStream(streamFromString(inputRaw, 21)),
    )
    const outputEvents = await collect(
      parseSseStream(streamFromString(outputRaw, 21)),
    )

    expect(
      inputEvents.some((event) => event.type === "content_block_start"),
    ).toBe(true)
    expect(
      outputEvents.some((event) => event.type === "content_block_start"),
    ).toBe(true)
  })

  it("parses error mid stream", async () => {
    const raw = readFileSync(
      resolve(fixturesDir, "error-mid-stream.sse"),
      "utf8",
    )
    const events = await collect(parseSseStream(streamFromString(raw, 7)))

    expect(events.map((event) => event.type)).toContain("error")
    expect(events.at(-1)).toEqual({ type: "message_stop" })
  })

  it("throws for invalid json payloads", async () => {
    const invalid = "event: message_start\ndata: {invalid json}\n\n"

    await expect(
      collect(parseSseStream(streamFromString(invalid, 5))),
    ).rejects.toThrow(/Invalid JSON/)
  })

  it("supports multiline data fields", async () => {
    const multiline = [
      "event: usage",
      'data: {"type":"usage",',
      'data: "input_tokens":1,',
      'data: "output_tokens":2,',
      'data: "cached_tokens":null}',
      "",
      "",
    ].join("\n")

    const events = await collect(parseSseStream(streamFromString(multiline, 4)))

    expect(events).toEqual([
      {
        type: "usage",
        input_tokens: 1,
        output_tokens: 2,
        cached_tokens: null,
      },
    ])
  })

  it("ignores keep-alive frames with no data lines", async () => {
    const withKeepAlive =
      ": keep-alive\n\n" +
      'event: message_stop\ndata: {"type":"message_stop"}\n\n'

    const events = await collect(
      parseSseStream(streamFromString(withKeepAlive, 3)),
    )

    expect(events).toEqual([{ type: "message_stop" }])
  })
})
