import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DatasourceToolResultCard } from "../components"

describe("DatasourceToolResultCard", () => {
  it("renders the provided type, title, and description", () => {
    render(
      <DatasourceToolResultCard
        type="COURSE"
        title="Programa de Diseño Elearning eInnovación"
        description="En este curso aprenderás los principios básicos de la innovación."
      />,
    )

    expect(screen.getByText("COURSE")).toBeTruthy()
    expect(
      screen.getByRole("heading", {
        name: "Programa de Diseño Elearning eInnovación",
      }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        "En este curso aprenderás los principios básicos de la innovación.",
      ),
    ).toBeTruthy()
    expect(
      screen.getByRole("article", {
        name: "COURSE: Programa de Diseño Elearning eInnovación",
      }),
    ).toBeTruthy()
    expect(screen.queryByText(/recursos/i)).toBeNull()
  })
})
