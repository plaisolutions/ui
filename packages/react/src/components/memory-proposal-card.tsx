import {
  HttpStatusError,
  type MemoryProposal,
  type MemoryProposalActions,
} from "@plaisolutions/client"
import { Brain, Check, LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import {
  getSupportedToolLocale,
  type SupportedToolLocale,
} from "./internal/tool-locale"
import { joinClasses } from "./internal/join-classes"

type Copy = {
  title: string
  user: string
  project: string
  create: string
  update: string
  delete: string
  previous: string
  proposed: string
  accept: string
  reject: string
  review: string
  unavailable: string
  accepted: string
  rejected: string
  expired: string
  conflicted: string
  conflictError: string
  expiredError: string
  permissionError: string
  genericError: string
}

const COPY: Record<SupportedToolLocale, Copy> = {
  en: {
    title: "Memory proposal",
    user: "Personal memory",
    project: "Project learning",
    create: "Create",
    update: "Update",
    delete: "Delete",
    previous: "Previous content",
    proposed: "Proposed content",
    accept: "Accept",
    reject: "Reject",
    review: "Sent for admin review",
    unavailable: "This proposal cannot be resolved here",
    accepted: "Accepted",
    rejected: "Rejected",
    expired: "Expired",
    conflicted: "Could not be applied because the memory changed",
    conflictError: "The memory changed. The latest status has been loaded.",
    expiredError: "This proposal is no longer available.",
    permissionError: "You no longer have permission to resolve this proposal.",
    genericError: "The proposal could not be resolved.",
  },
  es: {
    title: "Propuesta de memoria",
    user: "Memoria personal",
    project: "Aprendizaje del proyecto",
    create: "Crear",
    update: "Actualizar",
    delete: "Eliminar",
    previous: "Contenido anterior",
    proposed: "Contenido propuesto",
    accept: "Aceptar",
    reject: "Rechazar",
    review: "Enviado para revisión de un administrador",
    unavailable: "Esta propuesta no se puede resolver aquí",
    accepted: "Aceptada",
    rejected: "Rechazada",
    expired: "Caducada",
    conflicted: "No se pudo aplicar porque la memoria cambió",
    conflictError: "La memoria cambió. Se ha cargado el estado más reciente.",
    expiredError: "Esta propuesta ya no está disponible.",
    permissionError: "Ya no tienes permiso para resolver esta propuesta.",
    genericError: "No se pudo resolver la propuesta.",
  },
  ca: {
    title: "Proposta de memòria",
    user: "Memòria personal",
    project: "Aprenentatge del projecte",
    create: "Crear",
    update: "Actualitzar",
    delete: "Eliminar",
    previous: "Contingut anterior",
    proposed: "Contingut proposat",
    accept: "Acceptar",
    reject: "Rebutjar",
    review: "Enviat per a revisió d'un administrador",
    unavailable: "Aquesta proposta no es pot resoldre aquí",
    accepted: "Acceptada",
    rejected: "Rebutjada",
    expired: "Caducada",
    conflicted: "No s'ha pogut aplicar perquè la memòria ha canviat",
    conflictError: "La memòria ha canviat. S'ha carregat l'estat més recent.",
    expiredError: "Aquesta proposta ja no està disponible.",
    permissionError: "Ja no tens permís per resoldre aquesta proposta.",
    genericError: "No s'ha pogut resoldre la proposta.",
  },
  da: {
    title: "Hukommelsesforslag",
    user: "Personlig hukommelse",
    project: "Projektlæring",
    create: "Opret",
    update: "Opdater",
    delete: "Slet",
    previous: "Tidligere indhold",
    proposed: "Foreslået indhold",
    accept: "Acceptér",
    reject: "Afvis",
    review: "Sendt til administratorgennemgang",
    unavailable: "Forslaget kan ikke behandles her",
    accepted: "Accepteret",
    rejected: "Afvist",
    expired: "Udløbet",
    conflicted: "Kunne ikke anvendes, fordi hukommelsen blev ændret",
    conflictError: "Hukommelsen blev ændret. Den seneste status er indlæst.",
    expiredError: "Forslaget er ikke længere tilgængeligt.",
    permissionError:
      "Du har ikke længere tilladelse til at behandle forslaget.",
    genericError: "Forslaget kunne ikke behandles.",
  },
  de: {
    title: "Speichervorschlag",
    user: "Persönliche Erinnerung",
    project: "Projektwissen",
    create: "Erstellen",
    update: "Aktualisieren",
    delete: "Löschen",
    previous: "Vorheriger Inhalt",
    proposed: "Vorgeschlagener Inhalt",
    accept: "Akzeptieren",
    reject: "Ablehnen",
    review: "Zur Administratorprüfung gesendet",
    unavailable: "Dieser Vorschlag kann hier nicht bearbeitet werden",
    accepted: "Akzeptiert",
    rejected: "Abgelehnt",
    expired: "Abgelaufen",
    conflicted: "Nicht angewendet, da sich die Erinnerung geändert hat",
    conflictError:
      "Die Erinnerung hat sich geändert. Der aktuelle Status wurde geladen.",
    expiredError: "Dieser Vorschlag ist nicht mehr verfügbar.",
    permissionError: "Sie dürfen diesen Vorschlag nicht mehr bearbeiten.",
    genericError: "Der Vorschlag konnte nicht bearbeitet werden.",
  },
  fr: {
    title: "Proposition de mémoire",
    user: "Mémoire personnelle",
    project: "Apprentissage du projet",
    create: "Créer",
    update: "Modifier",
    delete: "Supprimer",
    previous: "Contenu précédent",
    proposed: "Contenu proposé",
    accept: "Accepter",
    reject: "Refuser",
    review: "Envoyé à un administrateur pour examen",
    unavailable: "Cette proposition ne peut pas être traitée ici",
    accepted: "Acceptée",
    rejected: "Refusée",
    expired: "Expirée",
    conflicted: "Impossible à appliquer car la mémoire a changé",
    conflictError: "La mémoire a changé. Le dernier état a été chargé.",
    expiredError: "Cette proposition n'est plus disponible.",
    permissionError:
      "Vous n'avez plus l'autorisation de traiter cette proposition.",
    genericError: "La proposition n'a pas pu être traitée.",
  },
  it: {
    title: "Proposta di memoria",
    user: "Memoria personale",
    project: "Apprendimento del progetto",
    create: "Crea",
    update: "Aggiorna",
    delete: "Elimina",
    previous: "Contenuto precedente",
    proposed: "Contenuto proposto",
    accept: "Accetta",
    reject: "Rifiuta",
    review: "Inviata alla revisione di un amministratore",
    unavailable: "Questa proposta non può essere gestita qui",
    accepted: "Accettata",
    rejected: "Rifiutata",
    expired: "Scaduta",
    conflicted: "Non applicata perché la memoria è cambiata",
    conflictError:
      "La memoria è cambiata. È stato caricato lo stato più recente.",
    expiredError: "Questa proposta non è più disponibile.",
    permissionError: "Non hai più il permesso di gestire questa proposta.",
    genericError: "Impossibile gestire la proposta.",
  },
  no: {
    title: "Minneforslag",
    user: "Personlig minne",
    project: "Prosjektlæring",
    create: "Opprett",
    update: "Oppdater",
    delete: "Slett",
    previous: "Tidligere innhold",
    proposed: "Foreslått innhold",
    accept: "Godta",
    reject: "Avvis",
    review: "Sendt til administratorgjennomgang",
    unavailable: "Forslaget kan ikke behandles her",
    accepted: "Godtatt",
    rejected: "Avvist",
    expired: "Utløpt",
    conflicted: "Kunne ikke brukes fordi minnet ble endret",
    conflictError: "Minnet ble endret. Den nyeste statusen er lastet inn.",
    expiredError: "Forslaget er ikke lenger tilgjengelig.",
    permissionError: "Du har ikke lenger tillatelse til å behandle forslaget.",
    genericError: "Forslaget kunne ikke behandles.",
  },
  pt: {
    title: "Proposta de memória",
    user: "Memória pessoal",
    project: "Aprendizagem do projeto",
    create: "Criar",
    update: "Atualizar",
    delete: "Eliminar",
    previous: "Conteúdo anterior",
    proposed: "Conteúdo proposto",
    accept: "Aceitar",
    reject: "Rejeitar",
    review: "Enviado para revisão de um administrador",
    unavailable: "Esta proposta não pode ser resolvida aqui",
    accepted: "Aceite",
    rejected: "Rejeitada",
    expired: "Expirada",
    conflicted: "Não aplicada porque a memória foi alterada",
    conflictError:
      "A memória foi alterada. O estado mais recente foi carregado.",
    expiredError: "Esta proposta já não está disponível.",
    permissionError: "Já não tem permissão para resolver esta proposta.",
    genericError: "Não foi possível resolver a proposta.",
  },
  sv: {
    title: "Minnesförslag",
    user: "Personligt minne",
    project: "Projektlärdom",
    create: "Skapa",
    update: "Uppdatera",
    delete: "Ta bort",
    previous: "Tidigare innehåll",
    proposed: "Föreslaget innehåll",
    accept: "Godkänn",
    reject: "Avvisa",
    review: "Skickat för administratörsgranskning",
    unavailable: "Förslaget kan inte hanteras här",
    accepted: "Godkänt",
    rejected: "Avvisat",
    expired: "Utgånget",
    conflicted: "Kunde inte tillämpas eftersom minnet ändrades",
    conflictError: "Minnet ändrades. Den senaste statusen har lästs in.",
    expiredError: "Förslaget är inte längre tillgängligt.",
    permissionError: "Du har inte längre behörighet att hantera förslaget.",
    genericError: "Förslaget kunde inte hanteras.",
  },
}

const REDACTED = "[redacted]"

export type MemoryProposalCardProps = {
  proposal: MemoryProposal
  actions: MemoryProposalActions
  activeAgentId: string
  locale?: string | null
  className?: string
}

export function MemoryProposalCard({
  proposal: initial,
  actions,
  activeAgentId,
  locale,
  className,
}: MemoryProposalCardProps) {
  const copy = COPY[getSupportedToolLocale(locale)]
  const [proposal, setProposal] = useState(initial)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () => setProposal((current) => mergeProposal(current, initial)),
    [initial],
  )

  async function resolve(accept: boolean) {
    if (resolving) return
    setResolving(true)
    setError(null)
    try {
      const next = accept
        ? await actions.acceptMemoryProposal({ proposalId: proposal.id })
        : await actions.rejectMemoryProposal({ proposalId: proposal.id })
      setProposal((current) => mergeProposal(current, next))
    } catch (cause) {
      const status = cause instanceof HttpStatusError ? cause.status : 0
      setError(
        status === 409
          ? copy.conflictError
          : status === 410
            ? copy.expiredError
            : status === 401 || status === 403
              ? copy.permissionError
              : copy.genericError,
      )
      try {
        const latest = await actions.getMemoryProposal({
          proposalId: proposal.id,
        })
        setProposal((current) => mergeProposal(current, latest))
      } catch {
        /* Preserve the proposal already visible in the conversation. */
      }
    } finally {
      setResolving(false)
    }
  }

  const canResolve =
    proposal.status === "PENDING" &&
    proposal.can_resolve === true &&
    proposal.agent_id === activeAgentId
  const statusCopy =
    proposal.status === "ACCEPTED"
      ? copy.accepted
      : proposal.status === "REJECTED"
        ? copy.rejected
        : proposal.status === "EXPIRED"
          ? copy.expired
          : proposal.status === "CONFLICTED"
            ? copy.conflicted
            : null
  const operation =
    proposal.operation === "CREATE"
      ? copy.create
      : proposal.operation === "UPDATE"
        ? copy.update
        : copy.delete

  return (
    <section
      className={joinClasses(
        "space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 text-left",
        className,
      )}
      data-memory-proposal-id={proposal.id}
    >
      <header className="space-y-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Brain className="size-4" />
          {copy.title}
        </h4>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5">
            {proposal.scope === "USER" ? copy.user : copy.project}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5">
            {operation}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5">
            {formatCategory(proposal.category)}
          </span>
        </div>
      </header>
      {proposal.previous_content && proposal.previous_content !== REDACTED ? (
        <div className="rounded-md bg-slate-100 p-3 text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            {copy.previous}
          </span>
          <p className="whitespace-pre-wrap break-words">
            {proposal.previous_content}
          </p>
        </div>
      ) : null}
      {proposal.content && proposal.content !== REDACTED ? (
        <div className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            {copy.proposed}
          </span>
          <p className="whitespace-pre-wrap break-words">{proposal.content}</p>
        </div>
      ) : null}
      {canResolve ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={resolving}
            onClick={() => void resolve(true)}
            className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {resolving ? (
              <LoaderCircle className="mr-2 size-3 animate-spin" />
            ) : null}
            {copy.accept}
          </button>
          <button
            type="button"
            disabled={resolving}
            onClick={() => void resolve(false)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {copy.reject}
          </button>
        </div>
      ) : null}
      {proposal.status === "PENDING" && !canResolve ? (
        <p className="text-xs font-medium text-slate-500">
          {proposal.scope === "PROJECT" ? copy.review : copy.unavailable}
        </p>
      ) : null}
      {proposal.status === "ACCEPTED" && statusCopy ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-xs font-medium text-slate-900 shadow-sm">
          {statusCopy}
          <Check
            className="size-3.5 stroke-[2.5] text-emerald-600"
            aria-hidden="true"
          />
        </span>
      ) : null}
      {statusCopy && proposal.status !== "ACCEPTED" ? (
        <p className="text-xs font-medium text-slate-500">{statusCopy}</p>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </section>
  )
}

function mergeProposal(
  current: MemoryProposal,
  incoming: MemoryProposal,
): MemoryProposal {
  if (current.id !== incoming.id) return incoming
  return {
    ...incoming,
    content: incoming.content === REDACTED ? current.content : incoming.content,
    previous_content:
      incoming.previous_content === REDACTED
        ? current.previous_content
        : incoming.previous_content,
    rationale:
      incoming.rationale === REDACTED ? current.rationale : incoming.rationale,
  }
}

function formatCategory(category: string) {
  const value = category.replaceAll("_", " ").toLowerCase()
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}
