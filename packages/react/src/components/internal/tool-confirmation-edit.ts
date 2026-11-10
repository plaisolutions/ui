import type { PendingConfirmation } from "@plaisolutions/client"

/**
 * Editing a held action from its card (mail and calendar events).
 *
 * The server decides which fields are editable (`pending.editable`) and checks
 * every edit again; this module only turns what the user types into a patch of
 * top-level keys. Dates are sent with an explicit UTC offset valid for the
 * action's own time zone, never the browser's: a card shown in another zone
 * must not shift the time of an event.
 */

export type FieldKind = "text" | "textarea" | "addresses" | "datetime"

export const FIELD_KINDS: Record<string, FieldKind> = {
  to: "addresses",
  cc: "addresses",
  attendees: "addresses",
  subject: "text",
  title: "text",
  location: "text",
  body: "textarea",
  start: "datetime",
  end: "datetime",
}

/** Editable fields in the order the form shows them. */
const FIELD_ORDER = [
  "to",
  "cc",
  "subject",
  "body",
  "title",
  "start",
  "end",
  "location",
  "attendees",
] as const

/** Fields of this action the card can show a control for. */
export function editableFields(pending: PendingConfirmation): string[] {
  const allowed = new Set(pending.editable ?? [])
  return FIELD_ORDER.filter((field) => allowed.has(field))
}

export type EditErrorKey =
  | "required"
  | "noRecipients"
  | "invalidAddress"
  | "invalidDateTime"
  | "ambiguousTime"
  | "endBeforeStart"

export type FieldError = { key: EditErrorKey; zone?: string }

export type Draft = Record<string, string>

// ── Time zones ─────────────────────────────────────────────────────────────

/** Where a date of the action is read: a named zone, or the fixed offset it came with. */
export type Zone =
  | { kind: "iana"; name: string }
  | { kind: "offset"; minutes: number; label: string }

const OFFSET_SUFFIX = /(Z|[+-]\d{2}:?\d{2})$/i

function parseOffsetMinutes(value: string): number | null {
  const match = OFFSET_SUFFIX.exec(value.trim())
  if (!match) return null
  const text = match[1].toUpperCase()
  if (text === "Z") return 0
  const sign = text[0] === "-" ? -1 : 1
  const digits = text.slice(1).replace(":", "")
  return sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)))
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+"
  const abs = Math.abs(minutes)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`
}

function isValidZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name })
    return true
  } catch {
    return false
  }
}

/**
 * The zone of the action: its own `time_zone`, else the offset its dates were
 * prepared with, else UTC (how the server reads a date without offset).
 */
export function actionZone(action: Record<string, unknown>): Zone {
  const named = action.time_zone
  if (typeof named === "string" && isValidZone(named)) {
    return { kind: "iana", name: named }
  }
  for (const field of ["start", "end"]) {
    const value = action[field]
    const minutes = typeof value === "string" ? parseOffsetMinutes(value) : null
    if (minutes !== null) {
      return { kind: "offset", minutes, label: `UTC${formatOffset(minutes)}` }
    }
  }
  return { kind: "offset", minutes: 0, label: "UTC" }
}

export function zoneLabel(zone: Zone): string {
  return zone.kind === "iana" ? zone.name : zone.label
}

const formatters = new Map<string, Intl.DateTimeFormat>()

/** Wall clock of an instant in `zone`, as if it were UTC (ms). */
function wallClockMs(instant: number, name: string): number {
  let formatter = formatters.get(name)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: name,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    formatters.set(name, formatter)
  }
  const parts: Record<string, number> = {}
  for (const part of formatter.formatToParts(new Date(instant))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value)
  }
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute,
    parts.second,
  )
}

/** Offset of `name` at `instant`, in minutes east of UTC. */
function offsetMinutesAt(instant: number, name: string): number {
  return Math.round((wallClockMs(instant, name) - instant) / 60_000)
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function toInputValue(wallMs: number): string {
  const date = new Date(wallMs)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

/** `YYYY-MM-DDTHH:mm` (a `datetime-local` value) of an ISO date, in `zone`. */
export function isoToLocalInput(iso: string, zone: Zone): string | null {
  const text = iso.trim()
  if (!OFFSET_SUFFIX.test(text)) {
    // Prepared without offset: it already is a wall clock time in the zone.
    const naive = LOCAL_INPUT.exec(text)
    return naive
      ? `${naive[1]}-${naive[2]}-${naive[3]}T${naive[4]}:${naive[5]}`
      : null
  }
  const instant = Date.parse(text)
  if (Number.isNaN(instant)) return null
  const wall =
    zone.kind === "iana"
      ? wallClockMs(instant, zone.name)
      : instant + zone.minutes * 60_000
  return toInputValue(wall)
}

export type LocalToIso =
  | { iso: string; error?: undefined }
  | { iso?: undefined; error: "invalid" | "ambiguous" }

/**
 * ISO 8601 with the UTC offset `zone` has at that wall clock time. A time that
 * happens twice (clocks go back) or never (clocks go forward) has no single
 * valid offset: it is rejected so the user picks another one.
 */
export function localInputToIso(local: string, zone: Zone): LocalToIso {
  const match = LOCAL_INPUT.exec(local.trim())
  if (!match) return { error: "invalid" }
  const [, year, month, day, hour, minute] = match
  const wall = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  )
  if (Number.isNaN(wall) || toInputValue(wall) !== local.trim().slice(0, 16)) {
    return { error: "invalid" }
  }
  const stamp = `${year}-${month}-${day}T${hour}:${minute}:00`
  if (zone.kind === "offset") {
    return { iso: `${stamp}${formatOffset(zone.minutes)}` }
  }
  // Offsets seen a day either side cover any single transition.
  const candidates = new Set<number>()
  for (const probe of [wall - 86_400_000, wall + 86_400_000]) {
    const offset = offsetMinutesAt(probe, zone.name)
    // It is a valid reading only if that offset maps back to the same wall clock.
    if (wallClockMs(wall - offset * 60_000, zone.name) === wall) {
      candidates.add(offset)
    }
  }
  if (candidates.size !== 1) return { error: "ambiguous" }
  const [offset] = candidates
  return { iso: `${stamp}${formatOffset(offset)}` }
}

// ── Draft and patch ────────────────────────────────────────────────────────

const EMAIL = /^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

/** What each field shows when the form opens: the prepared values. */
export function initialDraft(pending: PendingConfirmation): Draft {
  const action = pending.action as Record<string, unknown>
  const zone = actionZone(action)
  const draft: Draft = {}
  for (const field of editableFields(pending)) {
    const value = action[field]
    switch (FIELD_KINDS[field]) {
      case "addresses":
        draft[field] = Array.isArray(value)
          ? value.filter((item) => typeof item === "string").join(", ")
          : ""
        break
      case "datetime":
        draft[field] =
          typeof value === "string" ? (isoToLocalInput(value, zone) ?? "") : ""
        break
      default:
        draft[field] = asString(value)
    }
  }
  return draft
}

export function splitAddresses(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((address) => address.trim())
    .filter(Boolean)
}

export type PatchResult = {
  /** Changed fields only; empty when nothing changed. */
  patch: Record<string, unknown>
  errors: Record<string, FieldError>
}

/**
 * The patch for `draft` against the prepared values, or the field errors that
 * stop it. Unchanged fields are left out so the server keeps their exact value.
 */
export function buildPatch(
  pending: PendingConfirmation,
  draft: Draft,
  initial: Draft = initialDraft(pending),
): PatchResult {
  const action = pending.action as Record<string, unknown>
  const zone = actionZone(action)
  const zoneName = zoneLabel(zone)
  const patch: Record<string, unknown> = {}
  const errors: Record<string, FieldError> = {}

  for (const field of editableFields(pending)) {
    const value = draft[field] ?? ""
    if (value === (initial[field] ?? "")) continue
    switch (FIELD_KINDS[field]) {
      case "addresses": {
        const addresses = splitAddresses(value)
        if (addresses.some((address) => !EMAIL.test(address))) {
          errors[field] = { key: "invalidAddress" }
        } else if (field === "to" && addresses.length === 0) {
          errors[field] = { key: "noRecipients" }
        } else {
          patch[field] = addresses
        }
        break
      }
      case "datetime": {
        const converted = localInputToIso(value, zone)
        if (converted.error === "ambiguous") {
          errors[field] = { key: "ambiguousTime", zone: zoneName }
        } else if (converted.error) {
          errors[field] = { key: "invalidDateTime" }
        } else {
          patch[field] = converted.iso
        }
        break
      }
      case "text": {
        if (value.trim() === "") {
          // A subject or title cannot be emptied; a location can be cleared.
          if (field === "location") patch[field] = null
          else errors[field] = { key: "required" }
        } else {
          patch[field] = value
        }
        break
      }
      default:
        patch[field] = value
    }
  }

  // The end must follow the start, comparing what will actually be sent.
  const start = readInstant(patch.start, action.start)
  const end = readInstant(patch.end, action.end)
  if (
    !errors.end &&
    !errors.start &&
    (patch.start !== undefined || patch.end !== undefined) &&
    start !== null &&
    end !== null &&
    start >= end
  ) {
    errors.end = { key: "endBeforeStart" }
  }
  return { patch, errors }
}

function readInstant(edited: unknown, original: unknown): number | null {
  const value = typeof edited === "string" ? edited : original
  if (typeof value !== "string") return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}
