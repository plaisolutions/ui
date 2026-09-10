import type { UIToolCallPart, UIToolType } from "@plaisolutions/client"
import type { HTMLAttributes } from "react"
import { joinClasses } from "./internal/join-classes"
import {
  getSupportedToolLocale,
  type SupportedToolLocale,
} from "./internal/tool-locale"

type ToolUseAction =
  | "agent"
  | "datasource"
  | "documents"
  | "email"
  | "query"
  | "request"
  | "tool"
  | "web"
  | "workflow"

const TOOL_USE_ACTIONS: Record<UIToolType, ToolUseAction> = {
  agent_invocation: "agent",
  browser: "web",
  datasource: "datasource",
  email_send: "email",
  external_datasource: "query",
  firecrawl_search: "web",
  http_request: "request",
  mcp_tool: "request",
  office_documents: "documents",
  perplexity: "web",
  structured_datasource: "query",
  workflow_dispatch: "workflow",
  unknown: "tool",
}

const TOOL_USE_TRANSLATIONS: Record<
  SupportedToolLocale,
  Record<ToolUseAction, string>
> = {
  en: {
    agent: "Running agent {{toolName}}",
    datasource: "Searching in datasource {{toolName}}",
    documents: "Working with documents using {{toolName}}",
    email: "Sending email with {{toolName}}",
    query: "Querying {{toolName}}",
    request: "Sending a request with {{toolName}}",
    tool: "Running {{toolName}}",
    web: "Searching the web with {{toolName}}",
    workflow: "Running workflow {{toolName}}",
  },
  es: {
    agent: "Ejecutando el agente {{toolName}}",
    datasource: "Buscando en la fuente de datos {{toolName}}",
    documents: "Trabajando con documentos mediante {{toolName}}",
    email: "Enviando un correo con {{toolName}}",
    query: "Consultando {{toolName}}",
    request: "Ejecutando una petición con {{toolName}}",
    tool: "Ejecutando {{toolName}}",
    web: "Buscando en la web con {{toolName}}",
    workflow: "Ejecutando el flujo {{toolName}}",
  },
  ca: {
    agent: "Executant l’agent {{toolName}}",
    datasource: "Cercant a la font de dades {{toolName}}",
    documents: "Treballant amb documents mitjançant {{toolName}}",
    email: "Enviant un correu amb {{toolName}}",
    query: "Consultant {{toolName}}",
    request: "Executant una petició amb {{toolName}}",
    tool: "Executant {{toolName}}",
    web: "Cercant al web amb {{toolName}}",
    workflow: "Executant el flux {{toolName}}",
  },
  fr: {
    agent: "Exécution de l’agent {{toolName}}",
    datasource: "Recherche dans la source de données {{toolName}}",
    documents: "Traitement de documents avec {{toolName}}",
    email: "Envoi d’un e-mail avec {{toolName}}",
    query: "Interrogation de {{toolName}}",
    request: "Exécution d’une requête avec {{toolName}}",
    tool: "Exécution de {{toolName}}",
    web: "Recherche sur le web avec {{toolName}}",
    workflow: "Exécution du workflow {{toolName}}",
  },
  it: {
    agent: "Esecuzione dell’agente {{toolName}}",
    datasource: "Ricerca nella fonte dati {{toolName}}",
    documents: "Elaborazione di documenti con {{toolName}}",
    email: "Invio di un’email con {{toolName}}",
    query: "Interrogazione di {{toolName}}",
    request: "Esecuzione di una richiesta con {{toolName}}",
    tool: "Esecuzione di {{toolName}}",
    web: "Ricerca sul web con {{toolName}}",
    workflow: "Esecuzione del flusso {{toolName}}",
  },
  de: {
    agent: "Agent {{toolName}} wird ausgeführt",
    datasource: "Suche in der Datenquelle {{toolName}}",
    documents: "Dokumente werden mit {{toolName}} bearbeitet",
    email: "E-Mail wird mit {{toolName}} gesendet",
    query: "Abfrage von {{toolName}}",
    request: "Anfrage wird mit {{toolName}} ausgeführt",
    tool: "{{toolName}} wird ausgeführt",
    web: "Websuche mit {{toolName}}",
    workflow: "Workflow {{toolName}} wird ausgeführt",
  },
  da: {
    agent: "Kører agenten {{toolName}}",
    datasource: "Søger i datakilden {{toolName}}",
    documents: "Arbejder med dokumenter via {{toolName}}",
    email: "Sender e-mail med {{toolName}}",
    query: "Forespørger {{toolName}}",
    request: "Udfører en anmodning med {{toolName}}",
    tool: "Kører {{toolName}}",
    web: "Søger på nettet med {{toolName}}",
    workflow: "Kører workflowet {{toolName}}",
  },
  sv: {
    agent: "Kör agenten {{toolName}}",
    datasource: "Söker i datakällan {{toolName}}",
    documents: "Arbetar med dokument via {{toolName}}",
    email: "Skickar e-post med {{toolName}}",
    query: "Frågar {{toolName}}",
    request: "Kör en begäran med {{toolName}}",
    tool: "Kör {{toolName}}",
    web: "Söker på webben med {{toolName}}",
    workflow: "Kör arbetsflödet {{toolName}}",
  },
  no: {
    agent: "Kjører agenten {{toolName}}",
    datasource: "Søker i datakilden {{toolName}}",
    documents: "Arbeider med dokumenter via {{toolName}}",
    email: "Sender e-post med {{toolName}}",
    query: "Spør {{toolName}}",
    request: "Kjører en forespørsel med {{toolName}}",
    tool: "Kjører {{toolName}}",
    web: "Søker på nettet med {{toolName}}",
    workflow: "Kjører arbeidsflyten {{toolName}}",
  },
  pt: {
    agent: "Executando o agente {{toolName}}",
    datasource: "Pesquisando na fonte de dados {{toolName}}",
    documents: "Trabalhando com documentos usando {{toolName}}",
    email: "Enviando e-mail com {{toolName}}",
    query: "Consultando {{toolName}}",
    request: "Executando um pedido com {{toolName}}",
    tool: "Executando {{toolName}}",
    web: "Pesquisando na web com {{toolName}}",
    workflow: "Executando o fluxo {{toolName}}",
  },
}

export function getToolUseLabel(
  part: Pick<UIToolCallPart, "name" | "toolType">,
  locale?: string | null,
) {
  const action = part.toolType
    ? (TOOL_USE_ACTIONS[part.toolType] ?? "tool")
    : "tool"
  const template = TOOL_USE_TRANSLATIONS[getSupportedToolLocale(locale)][action]
  return template.replaceAll("{{toolName}}", part.name)
}

export type ToolUseIndicatorProps = Omit<
  HTMLAttributes<HTMLOutputElement>,
  "children" | "part"
> & {
  part: UIToolCallPart
  locale?: string | null
}

export function ToolUseIndicator({
  part,
  locale,
  className,
  ...props
}: ToolUseIndicatorProps) {
  const label = getToolUseLabel(part, locale)

  return (
    <output
      aria-live="polite"
      className={joinClasses("block min-h-10 py-2 text-sm", className)}
      data-tool-call-id={part.id}
      data-tool-call-state={part.state}
      {...props}
    >
      <span className="plai-tool-use-shimmer">{label}…</span>
    </output>
  )
}
