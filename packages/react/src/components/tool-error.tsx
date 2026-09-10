import type { UIToolCallPart } from "@plaisolutions/client"
import { ChevronDown, CircleX } from "lucide-react"
import type { HTMLAttributes } from "react"
import { useId, useState } from "react"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"
import {
  getSupportedToolLocale,
  type SupportedToolLocale,
} from "./internal/tool-locale"

type ToolErrorCopy = {
  summary: string
  input: string
  output: string
  details: string
  noOutput: string
}

const TOOL_ERROR_TRANSLATIONS: Record<SupportedToolLocale, ToolErrorCopy> = {
  en: {
    summary: "Failed to use tool {{toolName}}",
    input: "Input",
    output: "Output",
    details: "Error details",
    noOutput: "No output available",
  },
  es: {
    summary: "Falló al usar la tool {{toolName}}",
    input: "Entrada",
    output: "Salida",
    details: "Detalles del error",
    noOutput: "No hay salida disponible",
  },
  ca: {
    summary: "No s’ha pogut utilitzar l’eina {{toolName}}",
    input: "Entrada",
    output: "Sortida",
    details: "Detalls de l’error",
    noOutput: "No hi ha cap sortida disponible",
  },
  fr: {
    summary: "Échec de l’utilisation de l’outil {{toolName}}",
    input: "Entrée",
    output: "Sortie",
    details: "Détails de l’erreur",
    noOutput: "Aucune sortie disponible",
  },
  it: {
    summary: "Impossibile utilizzare lo strumento {{toolName}}",
    input: "Input",
    output: "Output",
    details: "Dettagli dell’errore",
    noOutput: "Nessun output disponibile",
  },
  de: {
    summary: "Tool {{toolName}} konnte nicht verwendet werden",
    input: "Eingabe",
    output: "Ausgabe",
    details: "Fehlerdetails",
    noOutput: "Keine Ausgabe verfügbar",
  },
  da: {
    summary: "Kunne ikke bruge værktøjet {{toolName}}",
    input: "Input",
    output: "Output",
    details: "Fejldetaljer",
    noOutput: "Intet output tilgængeligt",
  },
  sv: {
    summary: "Det gick inte att använda verktyget {{toolName}}",
    input: "Indata",
    output: "Utdata",
    details: "Feldetaljer",
    noOutput: "Ingen utdata tillgänglig",
  },
  no: {
    summary: "Kunne ikke bruke verktøyet {{toolName}}",
    input: "Inndata",
    output: "Utdata",
    details: "Feildetaljer",
    noOutput: "Ingen utdata tilgjengelig",
  },
  pt: {
    summary: "Falha ao usar a ferramenta {{toolName}}",
    input: "Entrada",
    output: "Saída",
    details: "Detalhes do erro",
    noOutput: "Nenhuma saída disponível",
  },
}

function formatJson(value: unknown) {
  const formatted = JSON.stringify(value, null, 2)
  return formatted ?? String(value)
}

function getToolErrorCopy(
  part: Pick<UIToolCallPart, "name">,
  locale?: string | null,
) {
  const copy = TOOL_ERROR_TRANSLATIONS[getSupportedToolLocale(locale)]
  return {
    ...copy,
    summary: copy.summary.replaceAll("{{toolName}}", part.name),
  }
}

export type ToolErrorProps = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "part"
> & {
  part: UIToolCallPart
  locale?: string | null
  defaultOpen?: boolean
}

export function ToolError({
  part,
  locale,
  defaultOpen = false,
  className,
  ...props
}: ToolErrorProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentId = useId()
  const copy = getToolErrorCopy(part, locale)
  const errorDetails = formatToolErrorDetails(part.errorDetails)

  return (
    <section
      className={joinClasses("text-sm text-neutral-600", className)}
      data-tool-call-id={part.id}
      data-tool-call-state={part.state}
      {...props}
    >
      <button
        type="button"
        aria-controls={contentId}
        aria-expanded={isOpen}
        className="inline-flex items-center gap-2 rounded-md py-1 text-left font-medium text-rose-600 transition-colors hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        onClick={() => setIsOpen((value) => !value)}
      >
        <CircleX className="size-4 shrink-0" aria-hidden="true" />
        <span>{copy.summary}</span>
        <ChevronDown
          className={joinClasses(
            "size-4 shrink-0 transition-transform motion-reduce:transition-none",
            isOpen ? "rotate-180" : undefined,
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          id={contentId}
          className="mt-2 space-y-3 border-l-2 border-rose-200 pl-3"
        >
          <div>
            <p className="mb-2 text-xs font-semibold text-neutral-700">
              {copy.input}
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-neutral-100 p-3 text-xs leading-5 text-neutral-800">
              {formatJson(part.input)}
            </pre>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-neutral-700">
              {copy.output}
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-neutral-100 p-3 text-xs leading-5 text-neutral-800">
              {part.result === undefined
                ? copy.noOutput
                : formatJson(part.result)}
            </pre>
          </div>

          {errorDetails ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-rose-700">
                {copy.details}
              </p>
              <p className="whitespace-pre-wrap text-xs leading-5 text-rose-700">
                {errorDetails}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
