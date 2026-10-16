import type { PlaiChatError } from "@plaisolutions/client"
import { CircleAlert } from "lucide-react"
import type { HTMLAttributes, ReactNode } from "react"
import { joinClasses } from "./internal/join-classes"
import {
  getSupportedToolLocale,
  type SupportedToolLocale,
} from "./internal/tool-locale"

type Copy = {
  title: string
  generic: string
  spendingTitle: string
  spending: string
  accounting: string
  unavailable: string
  rateTitle: string
  rate: string
  retry: string
  renewal: string
  network: string
}

const translations: Record<SupportedToolLocale, Copy> = {
  en: {
    title: "Unable to complete the request",
    generic: "Something went wrong. Please try again.",
    spendingTitle: "Monthly spending limit reached",
    spending:
      "This project has reached its monthly spending limit. Contact a project owner or admin to increase it.",
    accounting:
      "We cannot verify this project's spending. New requests are paused until accounting is complete.",
    unavailable:
      "We cannot verify this project's spending limit right now. Please try again later.",
    rateTitle: "Too many requests",
    rate: "Please wait before sending another request.",
    retry: "The server requested a wait of {seconds} seconds.",
    renewal: "The monthly period renews on {date} (UTC).",
    network: "Unable to connect. Check your connection and try again.",
  },
  es: {
    title: "No se pudo completar la solicitud",
    generic: "Se ha producido un error. Inténtalo de nuevo.",
    spendingTitle: "Límite de gasto mensual alcanzado",
    spending:
      "Este proyecto ha alcanzado su límite de gasto mensual. Contacta con un owner o admin del proyecto para aumentarlo.",
    accounting:
      "No podemos verificar el gasto del proyecto. Las nuevas solicitudes están detenidas hasta completar la contabilidad.",
    unavailable:
      "No podemos verificar el límite de gasto del proyecto en este momento. Inténtalo más tarde.",
    rateTitle: "Demasiadas solicitudes",
    rate: "Espera antes de enviar otra solicitud.",
    retry: "El servidor ha indicado una espera de {seconds} segundos.",
    renewal: "El periodo mensual se renueva el {date} (UTC).",
    network: "No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.",
  },
  ca: {
    title: "No s'ha pogut completar la sol·licitud",
    generic: "S'ha produït un error. Torna-ho a provar.",
    spendingTitle: "Límit de despesa mensual assolit",
    spending:
      "Aquest projecte ha assolit el límit de despesa mensual. Contacta amb un owner o admin del projecte per augmentar-lo.",
    accounting:
      "No podem verificar la despesa del projecte. Les noves sol·licituds estan aturades fins a completar la comptabilitat.",
    unavailable:
      "Ara no podem verificar el límit de despesa del projecte. Torna-ho a provar més tard.",
    rateTitle: "Massa sol·licituds",
    rate: "Espera abans d'enviar una altra sol·licitud.",
    retry: "El servidor ha indicat una espera de {seconds} segons.",
    renewal: "El període mensual es renova el {date} (UTC).",
    network:
      "No s'ha pogut connectar. Comprova la connexió i torna-ho a provar.",
  },
  fr: {
    title: "Impossible de terminer la demande",
    generic: "Une erreur est survenue. Veuillez réessayer.",
    spendingTitle: "Plafond de dépenses mensuel atteint",
    spending:
      "Ce projet a atteint son plafond de dépenses mensuel. Contactez un propriétaire ou administrateur du projet pour l'augmenter.",
    accounting:
      "Les dépenses du projet ne peuvent pas être vérifiées. Les nouvelles demandes sont suspendues jusqu'à la fin de la comptabilité.",
    unavailable:
      "Le plafond de dépenses ne peut pas être vérifié actuellement. Réessayez plus tard.",
    rateTitle: "Trop de demandes",
    rate: "Veuillez patienter avant d'envoyer une autre demande.",
    retry: "Le serveur a demandé une attente de {seconds} secondes.",
    renewal: "La période mensuelle se renouvelle le {date} (UTC).",
    network: "Connexion impossible. Vérifiez votre connexion et réessayez.",
  },
  it: {
    title: "Impossibile completare la richiesta",
    generic: "Si è verificato un errore. Riprova.",
    spendingTitle: "Limite di spesa mensile raggiunto",
    spending:
      "Questo progetto ha raggiunto il limite di spesa mensile. Contatta un proprietario o amministratore del progetto per aumentarlo.",
    accounting:
      "Non possiamo verificare la spesa del progetto. Le nuove richieste sono sospese fino al completamento della contabilità.",
    unavailable:
      "Al momento non possiamo verificare il limite di spesa. Riprova più tardi.",
    rateTitle: "Troppe richieste",
    rate: "Attendi prima di inviare un'altra richiesta.",
    retry: "Il server ha richiesto un'attesa di {seconds} secondi.",
    renewal: "Il periodo mensile si rinnova il {date} (UTC).",
    network: "Connessione non riuscita. Controlla la connessione e riprova.",
  },
  de: {
    title: "Anfrage konnte nicht abgeschlossen werden",
    generic: "Ein Fehler ist aufgetreten. Bitte erneut versuchen.",
    spendingTitle: "Monatliches Ausgabenlimit erreicht",
    spending:
      "Dieses Projekt hat sein monatliches Ausgabenlimit erreicht. Ein Projekteigentümer oder Administrator kann es erhöhen.",
    accounting:
      "Die Projektausgaben können nicht überprüft werden. Neue Anfragen sind bis zum Abschluss der Abrechnung ausgesetzt.",
    unavailable:
      "Das Ausgabenlimit kann derzeit nicht überprüft werden. Bitte später erneut versuchen.",
    rateTitle: "Zu viele Anfragen",
    rate: "Bitte vor einer weiteren Anfrage warten.",
    retry: "Der Server hat eine Wartezeit von {seconds} Sekunden angegeben.",
    renewal: "Der monatliche Zeitraum beginnt am {date} (UTC) neu.",
    network:
      "Verbindung fehlgeschlagen. Bitte Verbindung prüfen und erneut versuchen.",
  },
  da: {
    title: "Anmodningen kunne ikke fuldføres",
    generic: "Der opstod en fejl. Prøv igen.",
    spendingTitle: "Månedlig forbrugsgrænse nået",
    spending:
      "Projektet har nået sin månedlige forbrugsgrænse. Kontakt en projektejer eller administrator for at hæve den.",
    accounting:
      "Vi kan ikke bekræfte projektets forbrug. Nye anmodninger er sat på pause, indtil regnskabet er færdigt.",
    unavailable:
      "Vi kan ikke bekræfte forbrugsgrænsen lige nu. Prøv igen senere.",
    rateTitle: "For mange anmodninger",
    rate: "Vent, før du sender en ny anmodning.",
    retry: "Serveren har angivet en ventetid på {seconds} sekunder.",
    renewal: "Den månedlige periode fornyes den {date} (UTC).",
    network: "Forbindelsen mislykkedes. Kontrollér forbindelsen, og prøv igen.",
  },
  sv: {
    title: "Begäran kunde inte slutföras",
    generic: "Ett fel uppstod. Försök igen.",
    spendingTitle: "Månatlig utgiftsgräns nådd",
    spending:
      "Projektet har nått sin månatliga utgiftsgräns. Kontakta en projektägare eller administratör för att höja den.",
    accounting:
      "Vi kan inte verifiera projektets utgifter. Nya förfrågningar pausas tills redovisningen är klar.",
    unavailable:
      "Vi kan inte verifiera utgiftsgränsen just nu. Försök igen senare.",
    rateTitle: "För många förfrågningar",
    rate: "Vänta innan du skickar en ny förfrågan.",
    retry: "Servern har angett en väntetid på {seconds} sekunder.",
    renewal: "Den månatliga perioden förnyas den {date} (UTC).",
    network:
      "Anslutningen misslyckades. Kontrollera anslutningen och försök igen.",
  },
  no: {
    title: "Forespørselen kunne ikke fullføres",
    generic: "Det oppstod en feil. Prøv igjen.",
    spendingTitle: "Månedlig forbruksgrense nådd",
    spending:
      "Prosjektet har nådd sin månedlige forbruksgrense. Kontakt en prosjekteier eller administrator for å øke den.",
    accounting:
      "Vi kan ikke bekrefte prosjektets forbruk. Nye forespørsler er satt på pause til regnskapet er fullført.",
    unavailable: "Vi kan ikke bekrefte forbruksgrensen nå. Prøv igjen senere.",
    rateTitle: "For mange forespørsler",
    rate: "Vent før du sender en ny forespørsel.",
    retry: "Serveren har angitt en ventetid på {seconds} sekunder.",
    renewal: "Den månedlige perioden fornyes den {date} (UTC).",
    network: "Tilkoblingen mislyktes. Kontroller forbindelsen og prøv igjen.",
  },
  pt: {
    title: "Não foi possível concluir a solicitação",
    generic: "Ocorreu um erro. Tente novamente.",
    spendingTitle: "Limite de gastos mensal atingido",
    spending:
      "Este projeto atingiu o limite de gastos mensal. Entre em contato com um proprietário ou administrador do projeto para aumentá-lo.",
    accounting:
      "Não podemos verificar os gastos do projeto. Novas solicitações estão suspensas até a conclusão da contabilidade.",
    unavailable:
      "Não podemos verificar o limite de gastos agora. Tente novamente mais tarde.",
    rateTitle: "Muitas solicitações",
    rate: "Aguarde antes de enviar outra solicitação.",
    retry: "O servidor indicou uma espera de {seconds} segundos.",
    renewal: "O período mensal se renova em {date} (UTC).",
    network:
      "Não foi possível conectar. Verifique sua conexão e tente novamente.",
  },
}

export type ChatErrorProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  error: PlaiChatError | null
  locale?: string | null
  /** Overrides the default localized heading. */
  title?: ReactNode
}

/** Present useChat().error without adding generated messages or retrying requests. */
export function ChatError({
  error,
  locale,
  title,
  children,
  className,
  ...props
}: ChatErrorProps) {
  if (!error || error.type === "abort_error") return null
  const language = getSupportedToolLocale(locale)
  const copy = translations[language]
  const isSpending = error.code === "spending_cap_exceeded"
  const isRate = error.code === "rate_limit_exceeded" || error.status === 429
  const description = isSpending
    ? copy.spending
    : isRate
      ? copy.rate
      : error.code === "spending_cap_accounting_incomplete"
        ? copy.accounting
        : error.code === "spending_cap_state_unavailable"
          ? copy.unavailable
          : error.type === "network_error"
            ? copy.network
            : copy.generic
  const renewalDate =
    isSpending && error.periodEnd ? new Date(error.periodEnd) : null
  const validRenewal = renewalDate && Number.isFinite(renewalDate.getTime())
  return (
    <div
      role="alert"
      {...props}
      className={joinClasses(
        "plai-chat-error flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100",
        className,
      )}
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">
          {title ??
            (isSpending
              ? copy.spendingTitle
              : isRate
                ? copy.rateTitle
                : copy.title)}
        </p>
        {children ?? (
          <>
            <p>{description}</p>
            {isRate &&
            error.retryAfterSeconds !== undefined &&
            Number.isFinite(error.retryAfterSeconds) &&
            error.retryAfterSeconds >= 0 ? (
              <p>
                {copy.retry.replace(
                  "{seconds}",
                  String(Math.ceil(error.retryAfterSeconds)),
                )}
              </p>
            ) : null}
            {validRenewal ? (
              <p>
                {copy.renewal.replace(
                  "{date}",
                  new Intl.DateTimeFormat(language, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  }).format(renewalDate),
                )}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
