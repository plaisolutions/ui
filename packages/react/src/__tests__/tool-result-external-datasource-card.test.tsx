import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ToolResultCard } from "../components"

describe("ToolResultExternalDatasourceCard", () => {
  it("opens a sheet with the generated SQL and a normalized columnar result table", () => {
    const view = render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_external_1",
          name: "warehouse_query",
          toolType: "external_datasource",
          input: { query: "Show active users" },
          state: "completed",
          metadata: {
            type: "external_datasource",
            sql_query: "SELECT name, country FROM users WHERE active = true;",
            json_table: {
              name: { "0": "Ada", "1": "Lin" },
              country: { "0": "Spain", "1": "Japan" },
            },
          },
        }}
      />,
    )

    const trigger = screen.getByRole("button", {
      name: "External datasource: completed",
    })
    fireEvent.click(trigger)

    const sheet = screen.getByRole("dialog", { name: "External datasource" })
    expect(
      within(sheet).getByText("SELECT name, country FROM users WHERE active = true;"),
    ).toBeTruthy()
    expect(within(sheet).getByRole("columnheader", { name: "name" })).toBeTruthy()
    expect(within(sheet).getByText("Ada")).toBeTruthy()
    expect(within(sheet).getByText("Japan")).toBeTruthy()
    view.unmount()
  })

  it("shows structured errors in the sheet", () => {
    const view = render(
      <ToolResultCard
        part={{
          type: "tool-call",
          id: "tool_external_error",
          name: "warehouse_query",
          toolType: "external_datasource",
          input: { query: "Show active users" },
          state: "error",
          errorDetails: { message: "BigQuery permissions denied" },
          metadata: { type: "external_datasource", json_table: {} },
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "External datasource: error" }),
    )

    expect(screen.getByText(/BigQuery permissions denied/)).toBeTruthy()
    view.unmount()
  })
})
