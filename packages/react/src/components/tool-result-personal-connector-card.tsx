import type {
  PersonalConnectorEvent,
  PersonalConnectorInfo,
  PersonalConnectorMailMessage,
  PersonalConnectorMailSummary,
  PersonalConnectorToolResultMetadata,
  UIPersonalConnectorToolCallPart,
} from "@plaisolutions/client"
import { CalendarDays, ExternalLink, Mail, Video } from "lucide-react"
import { type ReactNode, useState } from "react"
import { joinClasses } from "./internal/join-classes"
import {
  type PersonalConnectorCopy,
  fillCopy,
  getPersonalConnectorCopy,
} from "./internal/personal-connector-copy"

export type ToolResultPersonalConnectorCardProps = {
  part: UIPersonalConnectorToolCallPart
  locale?: string | null
  className?: string
}

const COLLAPSED_ITEMS = 5
const COLLAPSED_BODY_CHARS = 600

type View =
  | { kind: "mail-list"; messages: PersonalConnectorMailSummary[] }
  | { kind: "mail"; message: PersonalConnectorMailMessage }
  | { kind: "events"; events: PersonalConnectorEvent[] }
  | { kind: "draft"; link: string | null; to: string[]; subject: string | null }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function hasId(value: unknown): value is { id: string } {
  return typeof asRecord(value)?.id === "string"
}

function getView(part: UIPersonalConnectorToolCallPart): View | null {
  const metadata = asRecord(
    part.metadata,
  ) as PersonalConnectorToolResultMetadata | null
  if (!metadata || metadata.error) return null
  const result = metadata.result

  switch (metadata.action) {
    case "search":
      return Array.isArray(result)
        ? {
            kind: "mail-list",
            messages: result.filter(hasId) as PersonalConnectorMailSummary[],
          }
        : null
    case "read":
      return hasId(result)
        ? { kind: "mail", message: result as PersonalConnectorMailMessage }
        : null
    case "list_events":
      return Array.isArray(result)
        ? {
            kind: "events",
            events: result.filter(hasId) as PersonalConnectorEvent[],
          }
        : null
    case "create_draft": {
      const input = asRecord(part.input)
      return {
        kind: "draft",
        link: text(asRecord(result)?.link),
        to: Array.isArray(input?.to)
          ? input.to.filter((item): item is string => typeof item === "string")
          : [],
        subject: text(input?.subject),
      }
    }
    default:
      return null
  }
}

/** Whether the part has a dedicated view; otherwise the generic card renders it. */
export function hasPersonalConnectorView(
  part: UIPersonalConnectorToolCallPart,
) {
  return part.state === "completed" && getView(part) !== null
}

function getConnector(
  part: UIPersonalConnectorToolCallPart,
): PersonalConnectorInfo | null {
  const connector = asRecord(asRecord(part.metadata)?.connector)
  return connector && typeof connector.label === "string"
    ? (connector as PersonalConnectorInfo)
    : null
}

function isCalendar(connector: PersonalConnectorInfo | null) {
  return connector?.capability.includes("calendar") ?? false
}

// ── Dates ──────────────────────────────────────────────────────────────────

function dateFormatter(
  locale: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
) {
  try {
    return new Intl.DateTimeFormat(locale ?? undefined, options)
  } catch {
    return new Intl.DateTimeFormat(undefined, options)
  }
}

/** All-day values come as "YYYY-MM-DD": read them as local dates, not UTC. */
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatMailDate(
  value: string | null | undefined,
  locale?: string | null,
) {
  const date = parseDate(value)
  if (!date) return value ?? null
  return isSameDay(date, new Date())
    ? dateFormatter(locale, { hour: "2-digit", minute: "2-digit" }).format(date)
    : dateFormatter(locale, { day: "numeric", month: "short" }).format(date)
}

function formatFullDate(
  value: string | null | undefined,
  locale?: string | null,
) {
  const date = parseDate(value)
  if (!date) return value ?? null
  return dateFormatter(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

// ── Shared pieces ──────────────────────────────────────────────────────────

/** "Ana Pérez <ana@acme.com>" → "Ana Pérez". */
function displayName(address: string | null | undefined) {
  if (!address) return null
  const match = /^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/.exec(address)
  return match ? match[1] : address
}

function count(
  copy: PersonalConnectorCopy,
  n: number,
  one: string,
  other: string,
) {
  return n === 1 ? one : fillCopy(other, { count: n })
}

function ExternalAnchor({
  href,
  className,
  children,
  label,
}: {
  href: string
  className?: string
  children: ReactNode
  label?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className={joinClasses(
        "inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:text-neutral-950 hover:underline",
        className,
      )}
    >
      {children}
    </a>
  )
}

function ShowAllToggle({
  total,
  expanded,
  onToggle,
  copy,
}: {
  total: number
  expanded: boolean
  onToggle: () => void
  copy: PersonalConnectorCopy
}) {
  if (total <= COLLAPSED_ITEMS) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full border-t border-neutral-200 px-3 py-2 text-left text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950"
    >
      {expanded ? copy.showLess : fillCopy(copy.showAll, { count: total })}
    </button>
  )
}

// ── Mail ───────────────────────────────────────────────────────────────────

function MailRow({
  message,
  locale,
  copy,
}: {
  message: PersonalConnectorMailSummary
  locale?: string | null
  copy: PersonalConnectorCopy
}) {
  const content = (
    <>
      <div className="flex items-baseline gap-2">
        <span
          aria-label={message.unread ? copy.unread : undefined}
          className={joinClasses(
            "h-2 w-2 shrink-0 self-center rounded-full",
            message.unread ? "bg-blue-600" : "bg-transparent",
          )}
        />
        <span
          className={joinClasses(
            "min-w-0 flex-1 truncate text-sm",
            message.unread
              ? "font-semibold text-neutral-950"
              : "text-neutral-800",
          )}
        >
          {displayName(message.from) ?? "—"}
        </span>
        <span className="shrink-0 text-xs text-neutral-500">
          {formatMailDate(message.date, locale)}
        </span>
      </div>
      <p
        className={joinClasses(
          "truncate pl-4 text-sm",
          message.unread ? "font-medium text-neutral-950" : "text-neutral-700",
        )}
      >
        {text(message.subject) ?? copy.noSubject}
      </p>
      {text(message.snippet) ? (
        <p className="line-clamp-1 pl-4 text-xs text-neutral-500">
          {message.snippet}
        </p>
      ) : null}
    </>
  )

  const className = "block space-y-0.5 px-3 py-2"
  return message.link ? (
    <a
      href={message.link}
      target="_blank"
      rel="noreferrer noopener"
      className={joinClasses(className, "hover:bg-neutral-50")}
    >
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  )
}

function MailList({
  messages,
  locale,
  copy,
}: {
  messages: PersonalConnectorMailSummary[]
  locale?: string | null
  copy: PersonalConnectorCopy
}) {
  const [expanded, setExpanded] = useState(false)
  if (messages.length === 0) {
    return <p className="px-3 py-3 text-sm text-neutral-600">{copy.noEmails}</p>
  }
  const visible = expanded ? messages : messages.slice(0, COLLAPSED_ITEMS)
  return (
    <>
      <ul className="divide-y divide-neutral-100">
        {visible.map((message) => (
          <li key={message.id}>
            <MailRow message={message} locale={locale} copy={copy} />
          </li>
        ))}
      </ul>
      <ShowAllToggle
        total={messages.length}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
        copy={copy}
      />
    </>
  )
}

function MailMessageView({
  message,
  connector,
  locale,
  copy,
}: {
  message: PersonalConnectorMailMessage
  connector: PersonalConnectorInfo | null
  locale?: string | null
  copy: PersonalConnectorCopy
}) {
  const [expanded, setExpanded] = useState(false)
  const body = text(message.body)
  const long = (body?.length ?? 0) > COLLAPSED_BODY_CHARS
  const shownBody =
    body && long && !expanded
      ? `${body.slice(0, COLLAPSED_BODY_CHARS).trimEnd()}…`
      : body

  return (
    <div className="space-y-3 px-3 py-3">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-neutral-950">
          {text(message.subject) ?? copy.noSubject}
        </h4>
        <div className="flex items-baseline gap-2 text-xs text-neutral-600">
          <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">
            {message.from ?? "—"}
          </span>
          <span className="shrink-0">
            {formatFullDate(message.date, locale)}
          </span>
        </div>
        {text(message.to) ? (
          <p className="truncate text-xs text-neutral-500">
            {copy.to}: {message.to}
          </p>
        ) : null}
        {text(message.cc) ? (
          <p className="truncate text-xs text-neutral-500">
            {copy.cc}: {message.cc}
          </p>
        ) : null}
      </div>
      {shownBody ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-neutral-800">
          {shownBody}
        </p>
      ) : null}
      <div className="flex items-center gap-4">
        {long ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-xs font-medium text-neutral-600 hover:text-neutral-950"
          >
            {expanded ? copy.showLess : copy.showMore}
          </button>
        ) : null}
        {message.link ? (
          <ExternalAnchor href={message.link}>
            {fillCopy(copy.openIn, { service: connector?.label ?? "" })}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </ExternalAnchor>
        ) : null}
      </div>
    </div>
  )
}

// ── Calendar ───────────────────────────────────────────────────────────────

function eventTime(
  event: PersonalConnectorEvent,
  locale: string | null | undefined,
  copy: PersonalConnectorCopy,
) {
  if (event.all_day) return copy.allDay
  const start = parseDate(event.start)
  const end = parseDate(event.end)
  if (!start) return null
  const time = dateFormatter(locale, { hour: "2-digit", minute: "2-digit" })
  return end
    ? `${time.format(start)} – ${time.format(end)}`
    : time.format(start)
}

function groupByDay(events: PersonalConnectorEvent[]) {
  const groups: { day: Date | null; events: PersonalConnectorEvent[] }[] = []
  for (const event of events) {
    const day = parseDate(event.start)
    const last = groups[groups.length - 1]
    if (
      last &&
      ((last.day && day && isSameDay(last.day, day)) || (!last.day && !day))
    ) {
      last.events.push(event)
    } else {
      groups.push({ day, events: [event] })
    }
  }
  return groups
}

function EventRow({
  event,
  locale,
  copy,
}: {
  event: PersonalConnectorEvent
  locale?: string | null
  copy: PersonalConnectorCopy
}) {
  const attendees = event.attendees?.length ?? 0
  const details = [
    text(event.location),
    attendees > 0
      ? count(copy, attendees, copy.attendeesOne, copy.attendeesOther)
      : null,
  ].filter(Boolean)

  return (
    <li className="flex gap-3 px-3 py-2">
      <span className="w-24 shrink-0 pt-0.5 text-xs tabular-nums text-neutral-600">
        {eventTime(event, locale, copy)}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        {event.link ? (
          <a
            href={event.link}
            target="_blank"
            rel="noreferrer noopener"
            className="block truncate text-sm font-medium text-neutral-950 hover:underline"
          >
            {text(event.title) ?? copy.noSubject}
          </a>
        ) : (
          <p className="truncate text-sm font-medium text-neutral-950">
            {text(event.title) ?? copy.noSubject}
          </p>
        )}
        {details.length > 0 ? (
          <p className="truncate text-xs text-neutral-500">
            {details.join(" · ")}
          </p>
        ) : null}
      </div>
      {event.online_meeting_url ? (
        <ExternalAnchor
          href={event.online_meeting_url}
          className="shrink-0 self-start"
        >
          <Video className="h-3.5 w-3.5" aria-hidden="true" />
          {copy.joinMeeting}
        </ExternalAnchor>
      ) : null}
    </li>
  )
}

function Agenda({
  events,
  locale,
  copy,
}: {
  events: PersonalConnectorEvent[]
  locale?: string | null
  copy: PersonalConnectorCopy
}) {
  const [expanded, setExpanded] = useState(false)
  if (events.length === 0) {
    return <p className="px-3 py-3 text-sm text-neutral-600">{copy.noEvents}</p>
  }
  const visible = expanded ? events : events.slice(0, COLLAPSED_ITEMS)
  const dayFormat = dateFormatter(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  return (
    <>
      <div className="divide-y divide-neutral-100">
        {groupByDay(visible).map((group, index) => (
          <section key={group.day?.toISOString() ?? `undated-${index}`}>
            {group.day ? (
              <h4 className="bg-neutral-50 px-3 py-1 text-xs font-medium capitalize text-neutral-600">
                {dayFormat.format(group.day)}
              </h4>
            ) : null}
            <ul className="divide-y divide-neutral-100">
              {group.events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  locale={locale}
                  copy={copy}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <ShowAllToggle
        total={events.length}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
        copy={copy}
      />
    </>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────

function DraftView({
  view,
  copy,
}: {
  view: Extract<View, { kind: "draft" }>
  copy: PersonalConnectorCopy
}) {
  return (
    <div className="space-y-1 px-3 py-3">
      <p className="text-sm font-medium text-neutral-950">{copy.draftSaved}</p>
      {view.subject ? (
        <p className="truncate text-sm text-neutral-800">{view.subject}</p>
      ) : null}
      {view.to.length > 0 ? (
        <p className="truncate text-xs text-neutral-500">
          {copy.to}: {view.to.join(", ")}
        </p>
      ) : null}
      {view.link ? (
        <ExternalAnchor href={view.link} className="pt-1">
          {copy.openDraft}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </ExternalAnchor>
      ) : null}
    </div>
  )
}

function headerCount(view: View, copy: PersonalConnectorCopy) {
  if (view.kind === "mail-list") {
    return count(
      copy,
      view.messages.length,
      copy.emailCountOne,
      copy.emailCountOther,
    )
  }
  if (view.kind === "events") {
    return count(
      copy,
      view.events.length,
      copy.eventCountOne,
      copy.eventCountOther,
    )
  }
  return null
}

export function ToolResultPersonalConnectorCard({
  part,
  locale,
  className,
}: ToolResultPersonalConnectorCardProps) {
  const view = getView(part)
  if (!view) return null

  const copy = getPersonalConnectorCopy(locale)
  const connector = getConnector(part)
  const Icon = isCalendar(connector) ? CalendarDays : Mail
  const total = headerCount(view, copy)

  return (
    <section
      className={joinClasses(
        "plai-tool-result-personal-connector-card overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-950",
        className,
      )}
      data-tool-call-id={part.id}
      data-tool-call-state={part.state}
      data-connector-action={view.kind}
    >
      <header className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 text-xs text-neutral-600">
        <Icon
          className="h-4 w-4 shrink-0 text-neutral-700"
          aria-hidden="true"
        />
        <span className="shrink-0 font-medium text-neutral-900">
          {connector?.label}
        </span>
        {connector?.account_email ? (
          <span className="min-w-0 truncate">· {connector.account_email}</span>
        ) : null}
        {total ? <span className="ml-auto shrink-0">{total}</span> : null}
      </header>

      {view.kind === "mail-list" ? (
        <MailList messages={view.messages} locale={locale} copy={copy} />
      ) : view.kind === "mail" ? (
        <MailMessageView
          message={view.message}
          connector={connector}
          locale={locale}
          copy={copy}
        />
      ) : view.kind === "events" ? (
        <Agenda events={view.events} locale={locale} copy={copy} />
      ) : (
        <DraftView view={view} copy={copy} />
      )}
    </section>
  )
}
