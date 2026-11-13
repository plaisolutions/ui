import type { UIMessage } from "@plaisolutions/client"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import {
  AssistantMessage,
  Message,
  MessageParts,
  getMessageGeneratedFiles,
  resolveGeneratedFileLinks,
  type GeneratedFileLinkTarget,
} from "../components"

const PNG = "https://storage.example.com/b/valor_inventario_por_categoria.png"
const XLSX = "https://storage.example.com/b/datos.xlsx"

const files: GeneratedFileLinkTarget[] = [
  {
    name: "valor_inventario_por_categoria.png",
    url: PNG,
    contentType: "image/png",
  },
  {
    name: "datos.xlsx",
    url: XLSX,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
]

const resolve = (markdown: string, list = files) =>
  resolveGeneratedFileLinks(markdown, list)

describe("resolveGeneratedFileLinks", () => {
  it("points an image to the url of its file", () => {
    expect(
      resolve(
        "![Gráfico](sandbox:/mnt/data/valor_inventario_por_categoria.png)",
      ),
    ).toBe(`![Gráfico](${PNG})`)
  })

  it("points a link to the url of its file", () => {
    expect(
      resolve(
        "[Descargar el gráfico](sandbox:/mnt/data/valor_inventario_por_categoria.png)",
      ),
    ).toBe(`[Descargar el gráfico](${PNG})`)
  })

  it("turns an image of a file that is not an image into a link", () => {
    expect(resolve("![x](sandbox:/mnt/data/datos.xlsx)")).toBe(`[x](${XLSX})`)
  })

  it("names the link after the file when the alt of that image is empty", () => {
    expect(resolve("![](sandbox:/mnt/data/datos.xlsx)")).toBe(
      `[datos.xlsx](${XLSX})`,
    )
  })

  it("reads the type of the file from its extension when it has no content type", () => {
    const list = [{ name: "plot.PNG", url: "https://s.example/plot.png" }]
    expect(resolve("![p](sandbox:/mnt/data/plot.PNG)", list)).toBe(
      "![p](https://s.example/plot.png)",
    )
  })

  it.each([
    "sandbox:/mnt/data/datos.xlsx",
    "sandbox:///mnt/data/datos.xlsx",
    "sandbox:datos.xlsx",
    "/mnt/data/datos.xlsx",
    "/mnt/user-data/outputs/datos.xlsx",
    "file:///mnt/data/datos.xlsx",
    "file:///home/sandbox/datos.xlsx",
    "attachment:datos.xlsx",
    "attachment:/datos.xlsx",
    "./datos.xlsx",
    "datos.xlsx",
    "outputs/datos.xlsx",
    "sandbox:/mnt/data/datos.xlsx?download=1#top",
    "<sandbox:/mnt/data/datos.xlsx>",
  ])("resolves the destination %s", (destination) => {
    expect(resolve(`[Datos](${destination})`)).toBe(`[Datos](${XLSX})`)
  })

  it("keeps the title of a link", () => {
    expect(resolve('[Datos](sandbox:/mnt/data/datos.xlsx "El Excel")')).toBe(
      `[Datos](${XLSX} "El Excel")`,
    )
  })

  it("matches names with spaces and accents, encoded or not", () => {
    const list = [
      {
        name: "ventas 2026 año.csv",
        url: "https://s.example/ventas.csv",
        contentType: "text/csv",
      },
    ]
    const expected = "[v](https://s.example/ventas.csv)"
    expect(
      resolve("[v](sandbox:/mnt/data/ventas%202026%20a%C3%B1o.csv)", list),
    ).toBe(expected)
    expect(
      resolve("[v](sandbox:/mnt/data/ventas%202026%20año.csv)", list),
    ).toBe(expected)
    expect(resolve("[v](<sandbox:/mnt/data/ventas 2026 año.csv>)", list)).toBe(
      expected,
    )
    // Spaces that were not escaped at all.
    expect(resolve("[v](sandbox:/mnt/data/ventas 2026 año.csv)", list)).toBe(
      expected,
    )
    // An accent written as a letter plus a combining mark.
    expect(
      resolve("[v](sandbox:/mnt/data/ventas 2026 an\u0303o.csv)", list),
    ).toBe(expected)
  })

  it("ignores the case of the name when there is no exact match", () => {
    expect(
      resolve("[g](sandbox:/mnt/data/VALOR_Inventario_por_Categoria.PNG)"),
    ).toBe(`[g](${PNG})`)
  })

  it("prefers the exact name over a name that only differs in case", () => {
    const list = [
      { name: "Data.csv", url: "https://s.example/upper.csv" },
      { name: "data.csv", url: "https://s.example/lower.csv" },
    ]
    expect(resolve("[a](sandbox:/mnt/data/data.csv)", list)).toBe(
      "[a](https://s.example/lower.csv)",
    )
  })

  it("wraps a url that markdown could not read as a destination", () => {
    const list = [{ name: "a.csv", url: "https://s.example/a (1).csv" }]
    expect(resolve("[a](sandbox:/mnt/data/a.csv)", list)).toBe(
      "[a](<https://s.example/a%20(1).csv>)",
    )
  })

  it("removes a sandbox link that matches no file and keeps its text", () => {
    expect(resolve("[Descargar](sandbox:/mnt/data/otro.png)")).toBe("Descargar")
    expect(resolve("Mira [esto](file:///tmp/x.csv), ¿vale?")).toBe(
      "Mira esto, ¿vale?",
    )
    expect(resolve("[a](/mnt/data/otro.png) y [b](attachment:z.pdf)")).toBe(
      "a y b",
    )
  })

  it("removes an image that matches no file, keeping its alt", () => {
    expect(resolve("![Gráfico](sandbox:/mnt/data/otro.png)")).toBe("Gráfico")
    expect(resolve("Antes ![](sandbox:/mnt/data/otro.png) después")).toBe(
      "Antes  después",
    )
  })

  it("removes links to files when the message has none", () => {
    expect(resolve("[a](sandbox:/mnt/data/datos.xlsx)", [])).toBe("a")
  })

  it("leaves a relative path that matches no file as written", () => {
    expect(resolve("[ver](otro.png) ![x](./sub/otro.png)")).toBe(
      "[ver](otro.png) ![x](./sub/otro.png)",
    )
  })

  it("never touches http(s), mailto, anchors or other destinations", () => {
    const text = [
      "[a](https://example.com/datos.xlsx)",
      "![b](http://example.com/valor_inventario_por_categoria.png)",
      "[c](HTTPS://example.com/datos.xlsx)",
      "[d](mailto:datos.xlsx@example.com)",
      "[e](#datos.xlsx)",
      "[f](//cdn.example.com/datos.xlsx)",
      "[g](/docs/datos.xlsx)",
      "[h](tel:+34123456)",
      "![i](data:image/png;base64,AAAA)",
      "[j](javascript:datos.xlsx)",
      "[k]()",
    ].join("\n")
    expect(resolve(text)).toBe(text)
  })

  it("leaves code blocks and code spans alone", () => {
    const text = [
      "```md",
      "![g](sandbox:/mnt/data/valor_inventario_por_categoria.png)",
      "```",
      "",
      "~~~",
      "[x](sandbox:/mnt/data/otro.png)",
      "~~~",
      "",
      "Usa `[x](sandbox:/mnt/data/datos.xlsx)` o ``![x](sandbox:/mnt/data/datos.xlsx)``.",
    ].join("\n")
    expect(resolve(text)).toBe(text)
  })

  it("leaves a code block that is still open alone", () => {
    const text =
      "```md\n![g](sandbox:/mnt/data/valor_inventario_por_categoria.png)"
    expect(resolve(text)).toBe(text)
  })

  it("resolves what is around code, not what is in it", () => {
    expect(
      resolve(
        [
          "[a](sandbox:/mnt/data/datos.xlsx)",
          "```",
          "[b](sandbox:/mnt/data/datos.xlsx)",
          "```",
          "[c](sandbox:/mnt/data/datos.xlsx) y `[d](sandbox:/mnt/data/datos.xlsx)`",
        ].join("\n"),
      ),
    ).toBe(
      [
        `[a](${XLSX})`,
        "```",
        "[b](sandbox:/mnt/data/datos.xlsx)",
        "```",
        `[c](${XLSX}) y \`[d](sandbox:/mnt/data/datos.xlsx)\``,
      ].join("\n"),
    )
  })

  it("keeps code spans inside the text of a link", () => {
    expect(resolve("[`datos`](sandbox:/mnt/data/datos.xlsx)")).toBe(
      `[\`datos\`](${XLSX})`,
    )
  })

  it("resolves an image that is inside a link", () => {
    expect(
      resolve(
        "[![g](sandbox:/mnt/data/valor_inventario_por_categoria.png)](https://example.com/informe)",
      ),
    ).toBe(`[![g](${PNG})](https://example.com/informe)`)
    expect(
      resolve(
        "[![g](sandbox:/mnt/data/otro.png)](sandbox:/mnt/data/datos.xlsx)",
      ),
    ).toBe(`[g](${XLSX})`)
  })

  it("does not read escaped brackets as links", () => {
    const text = "\\[a](sandbox:/mnt/data/otro.png)"
    expect(resolve(text)).toBe(text)
  })

  it("reads a link after an escaped exclamation mark as a link, as markdown does", () => {
    expect(resolve("\\![b](sandbox:/mnt/data/otro.png)")).toBe("\\!b")
  })

  it("resolves several links on a line", () => {
    expect(
      resolve(
        "![g](sandbox:/mnt/data/valor_inventario_por_categoria.png) [d](sandbox:/mnt/data/datos.xlsx) [n](sandbox:/mnt/data/no.csv)",
      ),
    ).toBe(`![g](${PNG}) [d](${XLSX}) n`)
  })

  describe("text that is still streaming", () => {
    const full =
      'Aquí tienes: ![Gráfico](sandbox:/mnt/data/valor_inventario_por_categoria.png) y [Descargar](sandbox:/mnt/data/datos.xlsx "Excel") listo.'

    it("leaves a half-written link or image as it is", () => {
      for (const text of [
        "[Descargar](sandbox:/mnt/da",
        "![gráf",
        "![gráfico](",
        "![gráfico](sandbox:",
        "[Descargar](sandbox:/mnt/data/datos.xlsx",
        '[Descargar](sandbox:/mnt/data/datos.xlsx "Exc',
        "[Descargar](<sandbox:/mnt/data/datos",
        "[Descargar](sandbox:/mnt/data/dat os",
        "[Descargar]",
        "[",
        "!",
        "![",
        "](",
        "`",
        "```",
      ]) {
        expect(resolve(text)).toBe(text)
      }
    })

    it("never throws and settles on the full result as the text grows", () => {
      const expected = `Aquí tienes: ![Gráfico](${PNG}) y [Descargar](${XLSX} "Excel") listo.`
      for (let length = 0; length <= full.length; length++) {
        const prefix = full.slice(0, length)
        expect(() => resolve(prefix)).not.toThrow()
        // A prefix never leaves a half-resolved link behind.
        expect(resolve(prefix)).not.toMatch(/\]\(sandbox:[^)]*\)/)
      }
      expect(resolve(full)).toBe(expected)
    })

    it("stays fast on a long text with many unclosed brackets", () => {
      const text = `${"[a ".repeat(5000)}\n\n${"![b](".repeat(2000)}`
      const start = performance.now()
      expect(resolve(text)).toBe(text)
      expect(performance.now() - start).toBeLessThan(1000)
    })
  })

  it("is idempotent", () => {
    const text = [
      "![g](sandbox:/mnt/data/valor_inventario_por_categoria.png)",
      "![x](sandbox:/mnt/data/datos.xlsx)",
      "[n](sandbox:/mnt/data/no.csv)",
      "[d](./datos.xlsx 'Excel') ![r](otro.png)",
      "`[c](sandbox:/mnt/data/datos.xlsx)`",
    ].join("\n")
    const once = resolve(text)
    expect(resolve(once)).toBe(once)
    const withParens = [{ name: "a.csv", url: "https://s.example/a (1).csv" }]
    const first = resolve("[a](sandbox:/mnt/data/a.csv)", withParens)
    expect(resolve(first, withParens)).toBe(first)
  })

  it("returns the text unchanged when it has no links", () => {
    const text = "Sin enlaces, solo [corchetes] y (paréntesis)."
    expect(resolve(text)).toBe(text)
    expect(resolve("")).toBe("")
  })

  it("ignores files without a name or a url", () => {
    expect(
      resolve("[a](sandbox:/mnt/data/a.csv)", [
        { name: "a.csv", url: "" },
        { name: "", url: "https://s.example/x" },
      ]),
    ).toBe("a")
  })
})

describe("getMessageGeneratedFiles", () => {
  it("collects the files of code_execution and office_documents with the url the cards download", () => {
    const message: UIMessage = {
      id: "m",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          id: "t1",
          name: "run",
          toolType: "code_execution",
          input: {},
          state: "completed",
          metadata: {
            type: "code_execution",
            media_files: [
              {
                id: "f1",
                name: "chart.png",
                content_type: "image/png",
                url: "https://s.example/chart.png",
              },
              { id: "f2", name: "no-url.csv" },
              {
                id: "f3",
                pathname: "threads/t/report.pdf",
                url: "https://s.example/r.pdf",
              },
            ],
          },
        },
        {
          type: "tool-call",
          id: "t2",
          name: "office",
          toolType: "office_documents",
          input: {},
          state: "completed",
          metadata: {
            type: "office_documents",
            media_files: [
              {
                id: "f4",
                name: "deck.pptx",
                url: "https://s.example/deck.pptx",
              },
            ],
          },
        },
        {
          type: "tool-call",
          id: "t3",
          name: "http",
          toolType: "http_request",
          input: {},
          state: "completed",
          metadata: {
            media_files: [
              { id: "x", name: "x.png", url: "https://s.example/x.png" },
            ],
          },
        },
      ],
    }

    expect(getMessageGeneratedFiles(message)).toEqual([
      {
        name: "chart.png",
        url: "https://s.example/chart.png",
        contentType: "image/png",
      },
      {
        name: "report.pdf",
        url: "https://s.example/r.pdf",
        contentType: undefined,
      },
      {
        name: "deck.pptx",
        url: "https://s.example/deck.pptx",
        contentType: undefined,
      },
    ])
  })
})

describe("MessageParts with generated file links", () => {
  afterEach(cleanup)

  const toolCall = {
    type: "tool-call" as const,
    id: "tool_code",
    name: "analyze",
    toolType: "code_execution" as const,
    input: {},
    state: "completed" as const,
    metadata: {
      type: "code_execution" as const,
      status: "success" as const,
      media_files: [
        {
          id: "f1",
          name: "valor_inventario_por_categoria.png",
          content_type: "image/png",
          url: PNG,
        },
        {
          id: "f2",
          name: "datos.xlsx",
          content_type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          url: XLSX,
        },
      ],
    },
  }

  const text =
    "![Gráfico](sandbox:/mnt/data/valor_inventario_por_categoria.png)\n[Datos](/mnt/data/datos.xlsx) [Otro](sandbox:/mnt/data/otro.csv)"
  const resolved = `![Gráfico](${PNG})\n[Datos](${XLSX}) Otro`

  const assistant = (extra: Partial<UIMessage> = {}): UIMessage => ({
    id: "m",
    role: "assistant",
    parts: [toolCall, { type: "text", text }],
    ...extra,
  })

  it("rewrites the text of the default rendering", () => {
    const { container } = render(<MessageParts message={assistant()} />)

    expect(container.querySelector("p")?.textContent).toBe(resolved)
  })

  it("hands renderText the text already resolved, and the original message", () => {
    const calls: { text: string; message: UIMessage }[] = []
    const message = assistant()
    render(
      <MessageParts
        message={message}
        renderText={(part, context) => {
          calls.push({ text: part.text, message: context.message })
          return <span>{part.text}</span>
        }}
      />,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]?.text).toBe(resolved)
    expect(calls[0]?.message).toBe(message)
    expect(message.parts[1]).toEqual({ type: "text", text })
  })

  it("resolves links for files of tool calls that come after the text", () => {
    const message = assistant({ parts: [{ type: "text", text }, toolCall] })
    const { container } = render(<MessageParts message={message} />)

    expect(container.querySelector("p")?.textContent).toBe(resolved)
  })

  it("can be turned off", () => {
    const { container } = render(
      <MessageParts message={assistant()} resolveFileLinks={false} />,
    )

    expect(container.querySelector("p")?.textContent).toBe(text)
  })

  it("leaves the text of a user message as the user wrote it", () => {
    const { container } = render(
      <MessageParts
        message={{
          id: "u",
          role: "user",
          parts: [{ type: "text", text: "[a](sandbox:/mnt/data/datos.xlsx)" }],
        }}
      />,
    )

    expect(container.querySelector("p")?.textContent).toBe(
      "[a](sandbox:/mnt/data/datos.xlsx)",
    )
  })

  it("hands renderText the same part when there is nothing to resolve", () => {
    const part = { type: "text" as const, text: "Hola" }
    const seen: unknown[] = []
    render(
      <MessageParts
        message={{ id: "m", role: "assistant", parts: [part] }}
        renderText={(received) => {
          seen.push(received)
          return null
        }}
      />,
    )

    expect(seen[0]).toBe(part)
  })
})

describe("Message and AssistantMessage with generated file links", () => {
  afterEach(cleanup)

  const codeExecution = {
    type: "tool-call" as const,
    id: "tool_code",
    name: "analyze",
    toolType: "code_execution" as const,
    input: {},
    state: "completed" as const,
    metadata: {
      type: "code_execution" as const,
      status: "success" as const,
      media_files: [
        {
          id: "f1",
          name: "x.png",
          content_type: "image/png",
          url: "https://files.test/x.png?sig=1",
        },
      ],
    },
  }

  const officeDocuments = {
    type: "tool-call" as const,
    id: "tool_office",
    name: "office",
    toolType: "office_documents" as const,
    input: {},
    state: "completed" as const,
    metadata: {
      type: "office_documents" as const,
      media_files: [
        {
          id: "f2",
          name: "x.png",
          content_type: "image/png",
          url: "https://files.test/office-x.png?sig=2",
        },
      ],
    },
  }

  const text =
    "![alt](sandbox:/mnt/data/x.png)\n[Descargar](sandbox:/mnt/data/x.png)"

  const message = (...parts: UIMessage["parts"]): UIMessage => ({
    id: "m",
    role: "assistant",
    parts,
  })

  function texts(
    render_: (renderText: (part: { text: string }) => null) => void,
  ) {
    const received: string[] = []
    render_((part) => {
      received.push(part.text)
      return null
    })
    return received
  }

  const viaMessage = (
    value: UIMessage,
    messagePartsProps: Record<string, unknown> = {},
  ) =>
    texts((renderText) => {
      render(
        <Message
          message={value}
          messagePartsProps={{ ...messagePartsProps, renderText }}
        />,
      )
    })

  const viaAssistantMessage = (
    value: UIMessage,
    messagePartsProps: Record<string, unknown> = {},
  ) =>
    texts((renderText) => {
      render(
        <AssistantMessage
          message={value}
          messagePartsProps={{ ...messagePartsProps, renderText }}
        />,
      )
    })

  const resolvedWith = (url: string) => `![alt](${url})\n[Descargar](${url})`

  it.each([
    ["Message", viaMessage],
    ["AssistantMessage", viaAssistantMessage],
  ])(
    "%s resolves with the code_execution files of the whole message",
    (_, view) => {
      expect(view(message(codeExecution, { type: "text", text }))).toEqual([
        resolvedWith("https://files.test/x.png?sig=1"),
      ])
    },
  )

  it.each([
    ["Message", viaMessage],
    ["AssistantMessage", viaAssistantMessage],
  ])(
    "%s resolves with the office_documents files of the whole message",
    (_, view) => {
      expect(view(message(officeDocuments, { type: "text", text }))).toEqual([
        resolvedWith("https://files.test/office-x.png?sig=2"),
      ])
    },
  )

  it("resolves the same as MessageParts does when used directly", () => {
    const value = message(codeExecution, { type: "text", text })
    expect(viaMessage(value)).toEqual(
      texts((renderText) => {
        render(<MessageParts message={value} renderText={renderText} />)
      }),
    )
  })

  it("resolves text that comes before the tool call, and in several text parts", () => {
    expect(
      viaMessage(
        message(
          { type: "text", text: "![a](sandbox:/mnt/data/x.png)" },
          codeExecution,
          { type: "text", text: "[b](/mnt/data/x.png)" },
        ),
      ),
    ).toEqual([
      "![a](https://files.test/x.png?sig=1)",
      "[b](https://files.test/x.png?sig=1)",
    ])
  })

  it("removes a link with no matching file and keeps its text", () => {
    expect(
      viaMessage(
        message(codeExecution, {
          type: "text",
          text: "[Descargar](sandbox:/mnt/data/otro.csv) ![Gráfico](sandbox:/mnt/data/otro.png)",
        }),
      ),
    ).toEqual(["Descargar Gráfico"])
  })

  it("does not touch http(s) links", () => {
    const http = "[a](https://example.com/x.png) ![b](http://example.com/x.png)"
    expect(
      viaMessage(message(codeExecution, { type: "text", text: http })),
    ).toEqual([http])
  })

  it.each([
    ["Message", viaMessage],
    ["AssistantMessage", viaAssistantMessage],
  ])(
    "%s hands the text over as written with resolveFileLinks={false}",
    (_, view) => {
      expect(
        view(message(codeExecution, { type: "text", text }), {
          resolveFileLinks: false,
        }),
      ).toEqual([text])
    },
  )

  it("leaves a message with only text, and no links, as it is", () => {
    const plain = "Hola, **mundo**. Mira [la web](https://example.com)."
    expect(viaMessage(message({ type: "text", text: plain }))).toEqual([plain])
  })

  it("uses the files it is given instead of those of the message", () => {
    expect(
      viaAssistantMessage(message(codeExecution, { type: "text", text }), {
        generatedFiles: [
          {
            name: "x.png",
            url: "https://files.test/given.png",
            contentType: "image/png",
          },
        ],
      }),
    ).toEqual([resolvedWith("https://files.test/given.png")])
  })

  it("renders the tool call card and the text in the same turn", () => {
    const { container } = render(
      <AssistantMessage
        message={message(codeExecution, { type: "text", text })}
        messagePartsProps={{ renderText: (part) => <span>{part.text}</span> }}
      />,
    )

    expect(
      container.querySelector(".plai-tool-result-code-execution-card"),
    ).toBeTruthy()
    expect(container.textContent).toContain("https://files.test/x.png?sig=1")
    expect(container.textContent).not.toContain("sandbox:")
  })
})
