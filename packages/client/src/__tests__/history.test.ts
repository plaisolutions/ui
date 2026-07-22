import { describe, expect, it } from "vitest"
import { normalizePlaiThreadMessages } from "../history"

describe("normalizePlaiThreadMessages", () => {
  it("normalizes API content blocks and legacy tool messages", () => {
    const messages = normalizePlaiThreadMessages([
      {
        id: "user_1",
        role: "user",
        content_blocks: [
          {
            type: "input_file",
            url: "https://example.com/report.pdf",
            title: "report.pdf",
          },
          { type: "text", content: "Read this" },
        ],
      },
      {
        id: "assistant_1",
        role: "assistant",
        contentBlocks: [
          { type: "text", content: "Done" },
          {
            type: "tool_use",
            toolInfo: {
              id: "tool_1",
              name: "search",
              tool_type: "perplexity",
              status: "completed",
              result: "ok",
            },
          },
        ],
      },
      {
        id: "legacy_tool",
        role: "tool",
        tool_result: {
          id: "tool_2",
          name: "browser",
          type: "browser",
          output: "result",
        },
      },
    ])

    expect(messages[0]?.parts.map((part) => part.type)).toEqual([
      "input_file",
      "text",
    ])
    expect(messages[1]?.parts.map((part) => part.type)).toEqual([
      "text",
      "tool-call",
    ])
    expect(messages[2]).toMatchObject({
      role: "assistant",
      parts: [{ type: "tool-call", id: "tool_2" }],
    })
  })
})
