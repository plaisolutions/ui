import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PromptForm } from "../components"
import { getSourceResultsCopy } from "../components/internal/source-results-copy"
import { getUiCopy } from "../components/internal/ui-copy"

afterEach(() => {
  cleanup()
  document.documentElement.lang = ""
})

describe("UI copy", () => {
  it.each([
    ["en", "Close"],
    ["es", "Cerrar"],
    ["ca", "Tanca"],
    ["fr", "Fermer"],
    ["it", "Chiudi"],
    ["pt", "Fechar"],
    ["de", "Schließen"],
    ["da", "Luk"],
    ["sv", "Stäng"],
    ["no", "Lukk"],
  ])("provides the %s translation", (locale, close) => {
    expect(getUiCopy(locale).close).toBe(close)
    expect(getUiCopy(locale).searchResults).toBeTruthy()
  })

  it("falls back to English for unsupported locales", () => {
    expect(getUiCopy("ja-JP")).toEqual(getUiCopy("en"))
    expect(getSourceResultsCopy("ja-JP")).toEqual(getSourceResultsCopy("en"))
    expect(getUiCopy("nb-NO").close).toBe("Lukk")
  })

  it("uses the document language for component defaults, while preserving explicit overrides", () => {
    document.documentElement.lang = "es-ES"

    render(
      <PromptForm value="Hola" onValueChange={vi.fn()} onSubmit={vi.fn()} />,
    )

    expect(screen.getByRole("button", { name: "Enviar" })).toBeTruthy()
    expect(screen.getByLabelText("Adjuntar archivo")).toBeTruthy()

    cleanup()
    render(
      <PromptForm
        locale="es-ES"
        value="Hola"
        onValueChange={vi.fn()}
        onSubmit={vi.fn()}
        sendLabel="Confirmar"
      />,
    )
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy()
  })
})
