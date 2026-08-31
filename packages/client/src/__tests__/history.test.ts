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

  it("normalizes persisted thinking summaries without private metadata", () => {
    const messages = normalizePlaiThreadMessages([
      {
        id: "assistant_1",
        role: "assistant",
        content_blocks: [
          { type: "text", content: "Before" },
          {
            type: "thinking",
            content: "Compared the available options.",
            thinking: "ignored because content takes precedence",
            signature: "private-provider-signature",
          },
          { type: "text", content: "After" },
        ],
      },
      {
        id: "assistant_2",
        role: "assistant",
        content_parts: [
          { type: "thinking", thinking: "Provider-shaped summary." },
          { type: "thinking", text: "Legacy summary." },
        ],
      },
    ])

    expect(messages[0]?.parts).toEqual([
      { type: "text", text: "Before" },
      {
        type: "thinking",
        thinking: "Compared the available options.",
        state: "completed",
      },
      { type: "text", text: "After" },
    ])
    expect(messages[1]?.parts).toEqual([
      {
        type: "thinking",
        thinking: "Provider-shaped summary.",
        state: "completed",
      },
      {
        type: "thinking",
        thinking: "Legacy summary.",
        state: "completed",
      },
    ])
  })

  it("normalizes media file ids for resending persisted attachments", () => {
    const messages = normalizePlaiThreadMessages([
      {
        id: "user_1",
        role: "user",
        content_blocks: [
          {
            type: "input_file",
            file_url: "https://example.com/report.pdf",
            title: "report.pdf",
            media_file_id: "media_file_1",
            metadata: { original_file_name: "original-report.pdf" },
          },
          {
            type: "input_image",
            url: "https://example.com/chart.png",
            title: "chart.png",
            metadata: { media_file_id: "media_file_2" },
          },
        ],
      },
    ])

    expect(messages[0]?.parts).toEqual([
      {
        type: "input_file",
        fileUrl: "https://example.com/report.pdf",
        title: "report.pdf",
        metadata: {
          original_file_name: "original-report.pdf",
          originalFileName: "original-report.pdf",
          sourceUrl: undefined,
          wasConverted: undefined,
          convertedFromExtension: undefined,
          mediaFileId: "media_file_1",
        },
      },
      {
        type: "input_image",
        url: "https://example.com/chart.png",
        title: "chart.png",
        metadata: {
          media_file_id: "media_file_2",
          originalFileName: undefined,
          sourceUrl: undefined,
          wasConverted: undefined,
          convertedFromExtension: undefined,
          mediaFileId: "media_file_2",
        },
      },
    ])
  })
})
