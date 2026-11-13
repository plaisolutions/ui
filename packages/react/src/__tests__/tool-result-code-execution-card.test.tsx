import type {
  CodeExecutionToolMetadata,
  UICodeExecutionToolCallPart,
} from "@plaisolutions/client"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { ToolResultCard, ToolResultCodeExecutionCard } from "../components"

const file = {
  id: "mf_1",
  name: "sales.csv",
  content_type: "text/csv",
  url: "https://example.com/sales.csv",
}

function makePart(
  metadata: CodeExecutionToolMetadata | undefined,
  overrides: Partial<UICodeExecutionToolCallPart> = {},
): UICodeExecutionToolCallPart {
  return {
    type: "tool-call",
    id: "tool_code",
    name: "analyze_sales",
    toolType: "code_execution",
    input: { prompt: "Analyze" },
    state: "completed",
    result: "Status: success",
    metadata,
    ...overrides,
  }
}

describe("ToolResultCodeExecutionCard", () => {
  afterEach(cleanup)

  it("shows a successful run with its generated files and a download link", () => {
    render(
      <ToolResultCodeExecutionCard
        part={makePart({
          type: "code_execution",
          status: "success",
          media_files: [file, { ...file, id: "mf_2", name: "chart.png" }],
        })}
      />,
    )

    const trigger = screen.getByRole("button", {
      name: "Code execution: 2 files",
    })
    expect(trigger.getAttribute("data-status")).toBe("success")

    fireEvent.click(trigger)
    expect(
      screen.getByRole("button", { name: "Download: sales.csv" }),
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Download: chart.png" }),
    ).toBeTruthy()
    expect(screen.queryByText("Steps")).toBeNull()
    expect(screen.queryByText("The result may be incomplete")).toBeNull()
  })

  it("says so when a successful run produced no files", () => {
    render(
      <ToolResultCodeExecutionCard
        part={makePart({ type: "code_execution", status: "success" })}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Code execution: completed" }),
    )
    expect(screen.getByText("No files were generated.")).toBeTruthy()
  })

  it("lists the executed steps with their kind, input, output and failed exit codes", () => {
    const { baseElement } = render(
      <ToolResultCodeExecutionCard
        part={makePart({
          type: "code_execution",
          status: "success",
          media_files: [file],
          steps: [
            {
              kind: "file_create",
              input: "/mnt/data/run.py",
              output: "created",
              exit_code: null,
            },
            {
              kind: "command",
              input: "python run.py",
              output: "all good",
              exit_code: 0,
            },
            {
              kind: "command",
              input: "python broken.py",
              output: "Traceback: boom",
              exit_code: 2,
            },
            {
              kind: "file_view",
              input: "/mnt/data/out.txt",
              output: "contents",
              exit_code: null,
            },
          ],
          steps_omitted: 0,
        })}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Code execution/ }))

    const steps = baseElement.querySelectorAll("li[data-step-kind]")
    expect(
      Array.from(steps).map((step) => step.getAttribute("data-step-kind")),
    ).toEqual(["file_create", "command", "command", "file_view"])
    expect(screen.getByText("File created")).toBeTruthy()
    expect(screen.getByText("File viewed")).toBeTruthy()

    const input = screen.getByText("python run.py")
    expect(input.tagName).toBe("PRE")
    expect(input.className).toContain("font-mono")
    expect(screen.getByText("Traceback: boom").className).toContain(
      "overflow-auto",
    )

    // Only the non-zero exit code is highlighted; null and 0 are not.
    expect(screen.getByText("Exit code 2")).toBeTruthy()
    expect(screen.queryByText(/Exit code 0/)).toBeNull()
    expect(
      baseElement.querySelectorAll('[data-step-failed="true"]'),
    ).toHaveLength(1)
    expect(screen.queryByText(/earlier step/)).toBeNull()
  })

  it("tells how many earlier steps were left out", () => {
    const steps = [
      { kind: "command" as const, input: "ls", output: "a", exit_code: 0 },
    ]
    const { rerender } = render(
      <ToolResultCodeExecutionCard
        part={makePart({ status: "success", steps, steps_omitted: 7 })}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Code execution/ }))
    expect(screen.getByText("7 earlier steps not shown")).toBeTruthy()

    rerender(
      <ToolResultCodeExecutionCard
        part={makePart({ status: "success", steps, steps_omitted: 1 })}
      />,
    )
    expect(screen.getByText("1 earlier step not shown")).toBeTruthy()
  })

  it("leaves the steps section out when the backend sent none", () => {
    render(
      <ToolResultCodeExecutionCard
        part={makePart({
          status: "success",
          media_files: [file],
          steps_omitted: 5,
        })}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Code execution/ }))
    expect(screen.queryByRole("region", { name: "Steps" })).toBeNull()
    expect(screen.queryByText(/earlier steps/)).toBeNull()
  })

  it("warns that a partial result may be incomplete and keeps the files", () => {
    render(
      <ToolResultCodeExecutionCard
        part={makePart({
          status: "partial",
          media_files: [file],
        })}
      />,
    )

    const trigger = screen.getByRole("button", {
      name: "Code execution: partial",
    })
    expect(trigger.getAttribute("data-status")).toBe("partial")

    fireEvent.click(trigger)
    expect(screen.getByRole("status").textContent).toBe(
      "The result may be incomplete",
    )
    expect(
      screen.getByRole("button", { name: "Download: sales.csv" }),
    ).toBeTruthy()
  })

  it("shows the error message of a failed run", () => {
    render(
      <ToolResultCodeExecutionCard
        part={makePart(
          {
            status: "error",
            media_files: [],
            error_details: {
              error_type: "SandboxError",
              error_code: "sandbox_timeout",
              error_message: "The sandbox timed out.",
            },
          },
          {
            state: "error",
            errorDetails: { error_message: "ignored fallback" },
          },
        )}
      />,
    )

    const trigger = screen.getByRole("button", {
      name: "Code execution: error",
    })
    expect(trigger.getAttribute("data-status")).toBe("error")

    fireEvent.click(trigger)
    expect(screen.getByRole("alert").textContent).toContain(
      "The sandbox timed out.",
    )
    expect(screen.queryByText("ignored fallback")).toBeNull()
    expect(screen.queryByText("No files were generated.")).toBeNull()
  })

  it("treats a completed result whose metadata says error as an error", () => {
    render(
      <ToolResultCodeExecutionCard
        part={makePart({
          status: "error",
          error_details: { error_message: "Out of memory" },
        })}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Code execution: error" }),
    )
    expect(screen.getByRole("alert").textContent).toContain("Out of memory")
  })

  it("falls back to the tool error details when the metadata has none", () => {
    render(
      <ToolResultCodeExecutionCard
        part={makePart(undefined, {
          state: "error",
          errorDetails: { error_message: "Tool failed" },
        })}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Code execution: error" }),
    )
    expect(screen.getByRole("alert").textContent).toContain("Tool failed")
  })

  it("tolerates malformed steps and files", () => {
    render(
      <ToolResultCodeExecutionCard
        part={makePart({
          status: "success",
          media_files: [null, { name: "no-id" }, file] as never,
          steps: [
            null,
            { kind: "teleport", input: "x", output: "y", exit_code: 0 },
            { kind: "command", input: "ok", exit_code: "1" },
          ] as never,
        })}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Code execution/ }))
    expect(screen.getAllByRole("button", { name: /Download/ })).toHaveLength(1)
    expect(screen.getByText("ok")).toBeTruthy()
    expect(screen.queryByText("teleport")).toBeNull()
    expect(screen.queryByText(/Exit code/)).toBeNull()
  })

  it("translates its copy", () => {
    render(
      <ToolResultCodeExecutionCard
        locale="es"
        part={makePart({ status: "partial", media_files: [file] })}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Ejecución de código: parcial" }),
    )
    expect(screen.getByText("El resultado puede estar incompleto")).toBeTruthy()
  })
})

describe("ToolResultCard with code_execution", () => {
  afterEach(cleanup)

  it("routes completed results to the code execution card", () => {
    render(
      <ToolResultCard
        part={makePart({ status: "success", media_files: [file] })}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Code execution: 1 file" }),
    ).toBeTruthy()
  })

  it("routes failed results to the code execution card instead of the generic error", () => {
    render(
      <ToolResultCard
        part={makePart(
          { status: "error", error_details: { error_message: "Boom" } },
          { state: "error" },
        )}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Code execution: error" }),
    )
    expect(screen.getByRole("alert").textContent).toContain("Boom")
  })

  it("shows the running-code label while pending", () => {
    render(
      <ToolResultCard
        locale="en"
        part={makePart(undefined, { state: "pending", result: undefined })}
      />,
    )

    expect(screen.getByRole("status").textContent).toBe(
      "Running code with analyze_sales…",
    )
  })

  it("translates the running-code label", () => {
    render(
      <ToolResultCard
        locale="es-ES"
        part={makePart(undefined, { state: "pending", result: undefined })}
      />,
    )

    expect(screen.getByRole("status").textContent).toBe(
      "Ejecutando código con analyze_sales…",
    )
  })
})
