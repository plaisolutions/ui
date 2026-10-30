import type { UIMessage } from "@plaisolutions/client"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { ConversationFilesSheet, getConversationFiles } from "../components"

const messages: UIMessage[] = [
  {
    id: "m1",
    role: "user",
    parts: [
      { type: "text", text: "Summarize these" },
      {
        type: "input_file",
        fileUrl: "https://storage.googleapis.com/b/converted.pdf",
        mimeType: "application/pdf",
        metadata: {
          mediaFileId: "mf_up_1",
          wasConverted: true,
          sourceUrl: "https://storage.googleapis.com/b/original.docx",
          originalFileName: "contract.docx",
        },
      },
      {
        type: "input_image",
        url: "https://storage.googleapis.com/b/photo.png",
        metadata: { mediaFileId: "mf_up_2" },
      },
    ],
  },
  {
    id: "m2",
    role: "assistant",
    parts: [
      {
        type: "tool-call",
        id: "t1",
        name: "office_documents",
        toolType: "office_documents",
        input: {},
        state: "completed",
        metadata: {
          type: "office_documents",
          media_files: [
            {
              id: "mf_gen_1",
              name: "summary.xlsx",
              url: "https://storage.googleapis.com/b/summary.xlsx",
            },
            { id: "mf_gen_no_url", name: "pending.docx" },
          ],
        },
      },
    ],
  },
  {
    id: "m3",
    role: "assistant",
    parts: [
      {
        type: "tool-call",
        id: "t2",
        name: "office_documents",
        toolType: "office_documents",
        input: {},
        state: "completed",
        metadata: {
          type: "office_documents",
          media_files: [
            {
              id: "mf_gen_1_again",
              name: "summary.xlsx",
              url: "https://storage.googleapis.com/b/summary.xlsx?X-Goog-Signature=abc",
            },
          ],
        },
      },
    ],
  },
]

describe("getConversationFiles", () => {
  it("collects uploads and generated files once, in conversation order", () => {
    const { uploaded, generated } = getConversationFiles(messages)

    expect(uploaded.map((file) => [file.id, file.name, file.url])).toEqual([
      [
        "mf_up_1",
        "contract.docx",
        "https://storage.googleapis.com/b/original.docx",
      ],
      ["mf_up_2", "photo.png", "https://storage.googleapis.com/b/photo.png"],
    ])
    expect(
      generated.map((file) => [file.id, file.extension, file.messageId]),
    ).toEqual([["mf_gen_1", "xlsx", "m2"]])
  })
})

describe("ConversationFilesSheet", () => {
  afterEach(cleanup)

  it("opens a localized sheet with uploaded and generated sections", () => {
    render(<ConversationFilesSheet messages={messages} locale="es" />)

    fireEvent.click(
      screen.getByRole("button", { name: "Archivos de la conversación: 3" }),
    )

    expect(
      screen.getByRole("region", { name: "Archivos subidos" }),
    ).toBeTruthy()
    expect(
      screen.getByRole("region", { name: "Archivos generados" }),
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Descargar: summary.xlsx" }),
    ).toBeTruthy()
  })

  it("says so when the conversation has no files", () => {
    render(
      <ConversationFilesSheet
        messages={[
          { id: "m", role: "user", parts: [{ type: "text", text: "hi" }] },
        ]}
        locale="en"
        open
      />,
    )

    expect(screen.getByText("No files in this conversation yet.")).toBeTruthy()
  })
})
