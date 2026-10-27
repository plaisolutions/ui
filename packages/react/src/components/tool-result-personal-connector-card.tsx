import type {
  ConfirmedAction,
  PendingConfirmation,
  PersonalConnectorEvent,
  PersonalConnectorInfo,
  PersonalConnectorMailMessage,
  PersonalConnectorMailSummary,
  PersonalConnectorToolResultMetadata,
  UIPersonalConnectorToolCallPart,
  UIToolConfirmationToolCallPart,
} from "@plaisolutions/client";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  Video,
  XCircle,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { joinClasses } from "./internal/join-classes";
import {
  type PersonalConnectorCopy,
  fillCopy,
  getPersonalConnectorCopy,
} from "./internal/personal-connector-copy";

export type ToolResultPersonalConnectorCardProps = {
  part: UIPersonalConnectorToolCallPart;
  locale?: string | null;
  className?: string;
};

const COLLAPSED_ITEMS = 5;
const COLLAPSED_BODY_CHARS = 600;

type View =
  | { kind: "mail-list"; messages: PersonalConnectorMailSummary[] }
  | { kind: "mail"; message: PersonalConnectorMailMessage }
  | { kind: "events"; events: PersonalConnectorEvent[] }
  | {
      kind: "draft";
      link: string | null;
      to: string[];
      subject: string | null;
      body: string | null;
    }
  | { kind: "pending-mail"; pending: PendingConfirmation }
  | {
      kind: "pending-event";
      operation: "create_event" | "update_event" | "delete_event";
      pending: PendingConfirmation;
    };

const EVENT_OPERATIONS = [
  "create_event",
  "update_event",
  "delete_event",
] as const;
type EventOperation = (typeof EVENT_OPERATIONS)[number];

function isEventOperation(value: unknown): value is EventOperation {
  return EVENT_OPERATIONS.includes(value as EventOperation);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function hasId(value: unknown): value is { id: string } {
  return typeof asRecord(value)?.id === "string";
}

function getView(part: UIPersonalConnectorToolCallPart): View | null {
  const metadata = asRecord(
    part.metadata,
  ) as PersonalConnectorToolResultMetadata | null;
  if (!metadata || metadata.error) return null;
  const result = metadata.result;

  const pending = asRecord(metadata.pending_confirmation);
  if (pending) {
    const confirmation = pending as PendingConfirmation;
    if (!asRecord(confirmation.action)) return null;
    if (metadata.action === "send") {
      return { kind: "pending-mail", pending: confirmation };
    }
    return isEventOperation(metadata.action)
      ? {
          kind: "pending-event",
          operation: metadata.action,
          pending: confirmation,
        }
      : null;
  }

  switch (metadata.action) {
    case "search":
      return Array.isArray(result)
        ? {
            kind: "mail-list",
            messages: result.filter(hasId) as PersonalConnectorMailSummary[],
          }
        : null;
    case "read":
      return hasId(result)
        ? { kind: "mail", message: result as PersonalConnectorMailMessage }
        : null;
    case "list_events":
      return Array.isArray(result)
        ? {
            kind: "events",
            events: result.filter(hasId) as PersonalConnectorEvent[],
          }
        : null;
    case "create_draft": {
      const input = asRecord(part.input);
      return {
        kind: "draft",
        link: text(asRecord(result)?.link),
        to: Array.isArray(input?.to)
          ? input.to.filter((item): item is string => typeof item === "string")
          : [],
        subject: text(input?.subject),
        body: text(input?.body),
      };
    }
    default:
      return null;
  }
}

/** Whether the part has a dedicated view; otherwise the generic card renders it. */
export function hasPersonalConnectorView(
  part: UIPersonalConnectorToolCallPart,
) {
  return part.state === "completed" && getView(part) !== null;
}

function getConnector(
  part: UIPersonalConnectorToolCallPart,
): PersonalConnectorInfo | null {
  const connector = asRecord(asRecord(part.metadata)?.connector);
  return connector && typeof connector.label === "string"
    ? (connector as PersonalConnectorInfo)
    : null;
}

function isCalendar(connector: PersonalConnectorInfo | null) {
  return connector?.capability.includes("calendar") ?? false;
}

// ── Dates ──────────────────────────────────────────────────────────────────

function dateFormatter(
  locale: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
) {
  try {
    return new Intl.DateTimeFormat(locale ?? undefined, options);
  } catch {
    return new Intl.DateTimeFormat(undefined, options);
  }
}

/** All-day values come as "YYYY-MM-DD": read them as local dates, not UTC. */
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMailDate(
  value: string | null | undefined,
  locale?: string | null,
) {
  const date = parseDate(value);
  if (!date) return value ?? null;
  return isSameDay(date, new Date())
    ? dateFormatter(locale, { hour: "2-digit", minute: "2-digit" }).format(date)
    : dateFormatter(locale, { day: "numeric", month: "short" }).format(date);
}

function formatFullDate(
  value: string | null | undefined,
  locale?: string | null,
) {
  const date = parseDate(value);
  if (!date) return value ?? null;
  return dateFormatter(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// ── Shared pieces ──────────────────────────────────────────────────────────

/** "Ana Pérez <ana@acme.com>" → "Ana Pérez". */
function displayName(address: string | null | undefined) {
  if (!address) return null;
  const match = /^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/.exec(address);
  return match ? match[1] : address;
}

function count(
  copy: PersonalConnectorCopy,
  n: number,
  one: string,
  other: string,
) {
  return n === 1 ? one : fillCopy(other, { count: n });
}

function ExternalAnchor({
  href,
  className,
  children,
  label,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  label?: string;
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
  );
}

function ShowAllToggle({
  total,
  expanded,
  onToggle,
  copy,
}: {
  total: number;
  expanded: boolean;
  onToggle: () => void;
  copy: PersonalConnectorCopy;
}) {
  if (total <= COLLAPSED_ITEMS) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full border-t border-neutral-200 px-3 py-2 text-left text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950"
    >
      {expanded ? copy.showLess : fillCopy(copy.showAll, { count: total })}
    </button>
  );
}

// ── Mail ───────────────────────────────────────────────────────────────────

function MailRow({
  message,
  locale,
  copy,
}: {
  message: PersonalConnectorMailSummary;
  locale?: string | null;
  copy: PersonalConnectorCopy;
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
  );

  const className = "block space-y-0.5 px-3 py-2";
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
  );
}

function MailList({
  messages,
  locale,
  copy,
}: {
  messages: PersonalConnectorMailSummary[];
  locale?: string | null;
  copy: PersonalConnectorCopy;
}) {
  const [expanded, setExpanded] = useState(false);
  if (messages.length === 0) {
    return (
      <p className="px-3 py-3 text-sm text-neutral-600">{copy.noEmails}</p>
    );
  }
  const visible = expanded ? messages : messages.slice(0, COLLAPSED_ITEMS);
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
  );
}

function MailMessageView({
  message,
  connector,
  locale,
  copy,
}: {
  message: PersonalConnectorMailMessage;
  connector: PersonalConnectorInfo | null;
  locale?: string | null;
  copy: PersonalConnectorCopy;
}) {
  const [expanded, setExpanded] = useState(false);
  const body = text(message.body);
  const long = (body?.length ?? 0) > COLLAPSED_BODY_CHARS;
  const shownBody =
    body && long && !expanded
      ? `${body.slice(0, COLLAPSED_BODY_CHARS).trimEnd()}…`
      : body;

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
  );
}

// ── Calendar ───────────────────────────────────────────────────────────────

function eventTime(
  event: PersonalConnectorEvent,
  locale: string | null | undefined,
  copy: PersonalConnectorCopy,
) {
  if (event.all_day) return copy.allDay;
  const start = parseDate(event.start);
  const end = parseDate(event.end);
  if (!start) return null;
  const time = dateFormatter(locale, { hour: "2-digit", minute: "2-digit" });
  return end
    ? `${time.format(start)} – ${time.format(end)}`
    : time.format(start);
}

function groupByDay(events: PersonalConnectorEvent[]) {
  const groups: { day: Date | null; events: PersonalConnectorEvent[] }[] = [];
  for (const event of events) {
    const day = parseDate(event.start);
    const last = groups[groups.length - 1];
    if (
      last &&
      ((last.day && day && isSameDay(last.day, day)) || (!last.day && !day))
    ) {
      last.events.push(event);
    } else {
      groups.push({ day, events: [event] });
    }
  }
  return groups;
}

function EventRow({
  event,
  locale,
  copy,
}: {
  event: PersonalConnectorEvent;
  locale?: string | null;
  copy: PersonalConnectorCopy;
}) {
  const attendees = event.attendees?.length ?? 0;
  const details = [
    text(event.location),
    attendees > 0
      ? count(copy, attendees, copy.attendeesOne, copy.attendeesOther)
      : null,
  ].filter(Boolean);

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
  );
}

function Agenda({
  events,
  locale,
  copy,
}: {
  events: PersonalConnectorEvent[];
  locale?: string | null;
  copy: PersonalConnectorCopy;
}) {
  const [expanded, setExpanded] = useState(false);
  if (events.length === 0) {
    return (
      <p className="px-3 py-3 text-sm text-neutral-600">{copy.noEvents}</p>
    );
  }
  const visible = expanded ? events : events.slice(0, COLLAPSED_ITEMS);
  const dayFormat = dateFormatter(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

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
  );
}

// ── Card ───────────────────────────────────────────────────────────────────

function CollapsibleBody({
  body,
  copy,
}: {
  body: string | null;
  copy: PersonalConnectorCopy;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!body) return null;
  const long = body.length > COLLAPSED_BODY_CHARS;
  return (
    <div className="space-y-1">
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-neutral-800">
        {long && !expanded
          ? `${body.slice(0, COLLAPSED_BODY_CHARS).trimEnd()}…`
          : body}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-xs font-medium text-neutral-600 hover:text-neutral-950"
        >
          {expanded ? copy.showLess : copy.showMore}
        </button>
      ) : null}
    </div>
  );
}

function DraftView({
  view,
  copy,
}: {
  view: Extract<View, { kind: "draft" }>;
  copy: PersonalConnectorCopy;
}) {
  return (
    <div className="space-y-2 px-3 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-neutral-950">
          {copy.draftSaved}
        </p>
        {view.subject ? (
          <p className="truncate text-sm text-neutral-800">{view.subject}</p>
        ) : null}
        {view.to.length > 0 ? (
          <p className="truncate text-xs text-neutral-500">
            {copy.to}: {view.to.join(", ")}
          </p>
        ) : null}
      </div>
      <CollapsibleBody body={view.body} copy={copy} />
      {view.link ? (
        <ExternalAnchor href={view.link}>
          {copy.openDraft}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </ExternalAnchor>
      ) : null}
    </div>
  );
}

// ── Pending confirmation ───────────────────────────────────────────────────

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-24 shrink-0 text-xs leading-5 text-neutral-500">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-words text-neutral-900">
        {children}
      </dd>
    </div>
  );
}

function PendingMailView({
  pending,
  copy,
}: {
  pending: PendingConfirmation;
  copy: PersonalConnectorCopy;
}) {
  const mail = pending.action;
  const to = strings(mail.to);
  const cc = strings(mail.cc);
  return (
    <div className="space-y-3 px-3 py-3">
      <dl className="space-y-1.5">
        <Field label={copy.to}>{to.join(", ") || "—"}</Field>
        {cc.length > 0 ? <Field label={copy.cc}>{cc.join(", ")}</Field> : null}
        <Field label={copy.subject}>
          <span className="font-medium">
            {text(mail.subject) ?? copy.noSubject}
          </span>
        </Field>
      </dl>
      {text(mail.reply_to_message_id) ? (
        <p className="text-xs text-neutral-500">{copy.replyInThread}</p>
      ) : null}
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
        <CollapsibleBody body={text(mail.body)} copy={copy} />
      </div>
    </div>
  );
}

function formatRange(
  start: unknown,
  end: unknown,
  allDay: boolean,
  locale: string | null | undefined,
  copy: PersonalConnectorCopy,
) {
  const from = parseDate(text(start));
  if (!from) return null;
  const day = dateFormatter(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(from);
  if (allDay) return `${day} · ${copy.allDay}`;
  const time = dateFormatter(locale, { hour: "2-digit", minute: "2-digit" });
  const to = parseDate(text(end));
  return to
    ? `${day} · ${time.format(from)} – ${time.format(to)}`
    : `${day} · ${time.format(from)}`;
}

/** Old value struck through next to the new one; only the new one if unknown. */
function Change({ before, after }: { before: ReactNode; after: ReactNode }) {
  if (before === null || before === undefined || before === after) {
    return <>{after}</>;
  }
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-neutral-500 line-through">{before}</span>
      <span aria-hidden="true">→</span>
      <span>{after}</span>
    </span>
  );
}

function PendingEventView({
  operation,
  pending,
  locale,
  copy,
}: {
  operation: EventOperation;
  pending: PendingConfirmation;
  locale?: string | null;
  copy: PersonalConnectorCopy;
}) {
  const action = pending.action;
  const current = asRecord(pending.current) as PersonalConnectorEvent | null;
  const has = (key: string) =>
    action[key] !== undefined && action[key] !== null;

  if (operation === "delete_event") {
    return (
      <div className="space-y-1 px-3 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-rose-700">
          {copy.deleteEvent}
        </p>
        <p className="text-sm font-medium text-neutral-900 line-through">
          {text(current?.title) ?? text(action.event_id) ?? copy.noSubject}
        </p>
        {current ? (
          <p className="text-xs text-neutral-500">
            {formatRange(
              current.start,
              current.end,
              Boolean(current.all_day),
              locale,
              copy,
            )}
          </p>
        ) : null}
        {(current?.attendees?.length ?? 0) > 0 ? (
          <p className="pt-1 text-xs text-neutral-600">
            {copy.attendeesNotified}
          </p>
        ) : null}
      </div>
    );
  }

  const isUpdate = operation === "update_event";
  const before = (key: keyof PersonalConnectorEvent) =>
    isUpdate && current ? (current[key] as unknown) : null;
  const attendees = strings(action.attendees);
  const timesChanged = has("start") || has("end");
  const newWhen = formatRange(
    action.start ?? current?.start,
    action.end ?? current?.end,
    Boolean(current?.all_day) && !timesChanged,
    locale,
    copy,
  );
  const oldWhen =
    isUpdate && current && timesChanged
      ? formatRange(
          current.start,
          current.end,
          Boolean(current.all_day),
          locale,
          copy,
        )
      : null;

  return (
    <div className="space-y-2 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {isUpdate ? copy.eventChange : copy.newEvent}
      </p>
      <dl className="space-y-1.5">
        {has("title") || !isUpdate ? (
          <Field label={copy.title}>
            <span className="font-medium">
              <Change
                before={text(before("title"))}
                after={text(action.title) ?? copy.noSubject}
              />
            </span>
          </Field>
        ) : current ? (
          <Field label={copy.title}>
            <span className="font-medium">{text(current.title)}</span>
          </Field>
        ) : null}
        {newWhen && (timesChanged || !isUpdate) ? (
          <Field label={copy.when}>
            <Change before={oldWhen} after={newWhen} />
          </Field>
        ) : null}
        {has("location") ? (
          <Field label={copy.location}>
            <Change
              before={text(before("location"))}
              after={text(action.location)}
            />
          </Field>
        ) : null}
        {has("attendees") ? (
          <Field label={copy.attendees}>
            <Change
              before={strings(before("attendees")).join(", ") || null}
              after={attendees.join(", ") || "—"}
            />
          </Field>
        ) : null}
        {has("description") ? (
          <Field label={copy.description}>
            <span className="whitespace-pre-wrap">
              {text(action.description)}
            </span>
          </Field>
        ) : null}
      </dl>
      {attendees.length > 0 ? (
        <p className="text-xs text-neutral-600">{copy.attendeesNotified}</p>
      ) : null}
    </div>
  );
}

function PendingBadge({ copy }: { copy: PersonalConnectorCopy }) {
  return (
    <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
      <Clock className="h-3 w-3" aria-hidden="true" />
      {copy.awaitingConfirmation}
    </span>
  );
}

function PendingFooter({ copy }: { copy: PersonalConnectorCopy }) {
  return (
    <p className="border-t border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-neutral-700">
      {copy.confirmHint}
    </p>
  );
}

function headerCount(view: View, copy: PersonalConnectorCopy) {
  if (view.kind === "mail-list") {
    return count(
      copy,
      view.messages.length,
      copy.emailCountOne,
      copy.emailCountOther,
    );
  }
  if (view.kind === "events") {
    return count(
      copy,
      view.events.length,
      copy.eventCountOne,
      copy.eventCountOther,
    );
  }
  return null;
}

export function ToolResultPersonalConnectorCard({
  part,
  locale,
  className,
}: ToolResultPersonalConnectorCardProps) {
  const view = getView(part);
  if (!view) return null;

  const copy = getPersonalConnectorCopy(locale);
  const connector = getConnector(part);
  const Icon = isCalendar(connector) ? CalendarDays : Mail;
  const total = headerCount(view, copy);
  const isPending =
    view.kind === "pending-mail" || view.kind === "pending-event";

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
          <span className="min-w-0 truncate border-neutral-500 border px-2 py-0.5 rounded-md text-xs text-neutral-500">
            {connector.account_email}
          </span>
        ) : null}
        {isPending ? (
          <PendingBadge copy={copy} />
        ) : total ? (
          <span className="ml-auto shrink-0">{total}</span>
        ) : null}
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
      ) : view.kind === "pending-mail" ? (
        <PendingMailView pending={view.pending} copy={copy} />
      ) : view.kind === "pending-event" ? (
        <PendingEventView
          operation={view.operation}
          pending={view.pending}
          locale={locale}
          copy={copy}
        />
      ) : (
        <DraftView view={view} copy={copy} />
      )}
      {isPending ? <PendingFooter copy={copy} /> : null}
    </section>
  );
}

// ── Confirmed actions ──────────────────────────────────────────────────────

const DONE_LABELS: Record<string, keyof PersonalConnectorCopy> = {
  send: "emailSent",
  create_event: "eventCreated",
  update_event: "eventUpdated",
  delete_event: "eventDeleted",
};

function getConfirmedActions(part: UIToolConfirmationToolCallPart) {
  const actions = asRecord(part.metadata)?.actions;
  return Array.isArray(actions)
    ? (actions.filter(
        (action) => typeof asRecord(action)?.action_id === "string",
      ) as ConfirmedAction[])
    : [];
}

/** Whether the confirmation result can be shown as a list of outcomes. */
export function hasToolConfirmationView(part: UIToolConfirmationToolCallPart) {
  return part.state !== "pending" && getConfirmedActions(part).length > 0;
}

function ConfirmedActionRow({
  action,
  copy,
}: {
  action: ConfirmedAction;
  copy: PersonalConnectorCopy;
}) {
  const metadata = asRecord(
    action.metadata,
  ) as PersonalConnectorToolResultMetadata | null;
  const connector = asRecord(
    metadata?.connector,
  ) as PersonalConnectorInfo | null;
  const operation = typeof metadata?.action === "string" ? metadata.action : "";
  const doneKey = DONE_LABELS[operation];
  const failed = action.status === "failed";
  const label = doneKey
    ? copy[doneKey]
    : fillCopy(copy.actionDone, { tool: action.tool_name });
  const link = text(asRecord(metadata?.result)?.link);

  return (
    <li className="flex items-start gap-2 px-3 py-2">
      {failed ? (
        <XCircle
          className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
          aria-hidden="true"
        />
      ) : (
        <CheckCircle2
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium text-neutral-950">
          {failed ? `${copy.actionFailed}: ${label}` : label}
        </p>
        {connector ? (
          <div className="flex items-center gap-2 truncate text-xs text-neutral-500">
            {connector.label}
            {connector.account_email ? (
              <span className="min-w-0 truncate border-neutral-500 border px-2 py-0.5 rounded-md text-xs text-neutral-500">
                {connector.account_email}
              </span>
            ) : null}
          </div>
        ) : null}
        {failed && text(action.error) ? (
          <p className="line-clamp-2 text-xs text-rose-700">{action.error}</p>
        ) : null}
      </div>
      {!failed && link ? (
        <ExternalAnchor href={link} className="shrink-0">
          {operation === "send" ? copy.openEmail : copy.openEvent}
        </ExternalAnchor>
      ) : null}
    </li>
  );
}

export type ToolResultToolConfirmationCardProps = {
  part: UIToolConfirmationToolCallPart;
  locale?: string | null;
  className?: string;
};

export function ToolResultToolConfirmationCard({
  part,
  locale,
  className,
}: ToolResultToolConfirmationCardProps) {
  const actions = getConfirmedActions(part);
  if (actions.length === 0) return null;
  const copy = getPersonalConnectorCopy(locale);
  return (
    <ul
      className={joinClasses(
        "plai-tool-result-tool-confirmation-card divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-950",
        className,
      )}
      data-tool-call-id={part.id}
      data-tool-call-state={part.state}
    >
      {actions.map((action) => (
        <ConfirmedActionRow
          key={action.action_id}
          action={action}
          copy={copy}
        />
      ))}
    </ul>
  );
}

// ── Any other tool awaiting confirmation (HTTP, MCP, workflows...) ─────────

export function getPendingConfirmation(part: {
  metadata?: unknown;
}): PendingConfirmation | null {
  const pending = asRecord(asRecord(part.metadata)?.pending_confirmation);
  return pending && asRecord(pending.action)
    ? (pending as PendingConfirmation)
    : null;
}

function formatValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export type ToolResultPendingConfirmationCardProps = {
  part: { id: string; name: string; state: string; metadata?: unknown };
  locale?: string | null;
  className?: string;
};

/** Generic preview of a held tool call: its name and the exact arguments. */
export function ToolResultPendingConfirmationCard({
  part,
  locale,
  className,
}: ToolResultPendingConfirmationCardProps) {
  const pending = getPendingConfirmation(part);
  if (!pending) return null;
  const copy = getPersonalConnectorCopy(locale);
  const entries = Object.entries(pending.action).filter(
    ([key, value]) =>
      key !== "operation" && value !== null && value !== undefined,
  );
  return (
    <section
      className={joinClasses(
        "plai-tool-result-pending-confirmation-card overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-950",
        className,
      )}
      data-tool-call-id={part.id}
      data-tool-call-state={part.state}
    >
      <header className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 text-xs text-neutral-600">
        <span className="truncate font-mono font-medium text-neutral-900">
          {part.name}
        </span>
        <PendingBadge copy={copy} />
      </header>
      {entries.length > 0 ? (
        <dl className="space-y-1.5 px-3 py-3">
          {entries.map(([key, value]) => (
            <Field key={key} label={key}>
              <span className="whitespace-pre-wrap font-mono text-xs">
                {formatValue(value)}
              </span>
            </Field>
          ))}
        </dl>
      ) : null}
      <PendingFooter copy={copy} />
    </section>
  );
}
