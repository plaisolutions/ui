import type { PendingConfirmation } from "@plaisolutions/client"
import { describe, expect, it } from "vitest"
import {
  actionZone,
  buildPatch,
  editableFields,
  initialDraft,
  isoToLocalInput,
  localInputToIso,
} from "../components/internal/tool-confirmation-edit"

const MADRID = { kind: "iana", name: "Europe/Madrid" } as const

function mail(
  overrides: Partial<PendingConfirmation> = {},
): PendingConfirmation {
  return {
    action_id: "a-1",
    tool_name: "gmail_send",
    kind: "mail",
    operation: "send",
    editable: ["to", "cc", "subject", "body"],
    action: {
      operation: "send",
      to: ["ana@acme.com", "luis@acme.com"],
      subject: "Hola",
      body: "Texto",
    },
    ...overrides,
  }
}

function event(action: Record<string, unknown> = {}): PendingConfirmation {
  return {
    action_id: "e-1",
    tool_name: "google_calendar_create_event",
    kind: "calendar",
    operation: "create",
    editable: ["title", "start", "end", "location", "attendees"],
    action: {
      operation: "create_event",
      title: "Demo",
      start: "2027-11-15T10:00:00+01:00",
      end: "2027-11-15T11:00:00+01:00",
      time_zone: "Europe/Madrid",
      ...action,
    },
  }
}

describe("editable fields", () => {
  it("only offers what the server declares, in form order", () => {
    expect(editableFields(mail())).toEqual(["to", "cc", "subject", "body"])
    expect(
      editableFields(mail({ editable: ["body", "to", "inventado"] })),
    ).toEqual(["to", "body"])
    expect(editableFields(mail({ editable: [] }))).toEqual([])
    expect(editableFields(mail({ editable: undefined }))).toEqual([])
  })
})

describe("time zones", () => {
  it("shows an instant as the wall clock of the action's zone, not the browser's", () => {
    // 09:00 UTC is 10:00 in Madrid in winter and 11:00 in summer.
    expect(isoToLocalInput("2027-11-15T09:00:00Z", MADRID)).toBe(
      "2027-11-15T10:00",
    )
    expect(isoToLocalInput("2027-07-15T09:00:00Z", MADRID)).toBe(
      "2027-07-15T11:00",
    )
    expect(isoToLocalInput("2027-11-15T10:00:00+01:00", MADRID)).toBe(
      "2027-11-15T10:00",
    )
  })

  it("reads a date prepared without offset as already local", () => {
    expect(isoToLocalInput("2027-11-15T10:00:00", MADRID)).toBe(
      "2027-11-15T10:00",
    )
    expect(isoToLocalInput("mañana", MADRID)).toBeNull()
  })

  it("adds the offset the zone has on that date", () => {
    expect(localInputToIso("2027-11-15T10:00", MADRID)).toEqual({
      iso: "2027-11-15T10:00:00+01:00",
    })
    expect(localInputToIso("2027-07-15T10:00", MADRID)).toEqual({
      iso: "2027-07-15T10:00:00+02:00",
    })
    expect(
      localInputToIso("2027-07-15T10:00", {
        kind: "iana",
        name: "America/New_York",
      }),
    ).toEqual({ iso: "2027-07-15T10:00:00-04:00" })
  })

  it("rejects a time that happens twice or never", () => {
    // Madrid, 2027: clocks go back on Oct 31 (02:30 twice) and forward on Mar 28 (02:30 never).
    expect(localInputToIso("2027-10-31T02:30", MADRID)).toEqual({
      error: "ambiguous",
    })
    expect(localInputToIso("2027-03-28T02:30", MADRID)).toEqual({
      error: "ambiguous",
    })
    // The hours around them are fine.
    expect(localInputToIso("2027-10-31T01:30", MADRID).iso).toBe(
      "2027-10-31T01:30:00+02:00",
    )
    expect(localInputToIso("2027-10-31T03:30", MADRID).iso).toBe(
      "2027-10-31T03:30:00+01:00",
    )
    expect(localInputToIso("2027-03-28T03:30", MADRID).iso).toBe(
      "2027-03-28T03:30:00+02:00",
    )
  })

  it("rejects values that are not a real date", () => {
    expect(localInputToIso("", MADRID)).toEqual({ error: "invalid" })
    expect(localInputToIso("2027-02-30T10:00", MADRID)).toEqual({
      error: "invalid",
    })
    expect(localInputToIso("2027-13-01T10:00", MADRID)).toEqual({
      error: "invalid",
    })
  })

  it("keeps the offset an action came with when it has no named zone", () => {
    const zone = actionZone({ start: "2027-11-15T10:00:00+05:30" })
    expect(zone).toMatchObject({ kind: "offset", minutes: 330 })
    expect(localInputToIso("2027-11-15T10:00", zone)).toEqual({
      iso: "2027-11-15T10:00:00+05:30",
    })
    expect(actionZone({ title: "x" })).toMatchObject({
      kind: "offset",
      minutes: 0,
    })
    // An unknown zone name is ignored instead of breaking the card.
    expect(
      actionZone({ time_zone: "Nope/Nowhere", start: "2027-11-15T10:00:00Z" }),
    ).toMatchObject({
      kind: "offset",
      minutes: 0,
    })
  })
})

describe("draft and patch", () => {
  it("starts from the prepared values", () => {
    expect(initialDraft(mail())).toEqual({
      to: "ana@acme.com, luis@acme.com",
      cc: "",
      subject: "Hola",
      body: "Texto",
    })
    expect(initialDraft(event())).toMatchObject({
      title: "Demo",
      start: "2027-11-15T10:00",
      end: "2027-11-15T11:00",
    })
  })

  it("sends only what changed", () => {
    const pending = mail()
    const draft = { ...initialDraft(pending), subject: "Hola, Ana" }

    expect(buildPatch(pending, draft)).toEqual({
      patch: { subject: "Hola, Ana" },
      errors: {},
    })
    expect(buildPatch(pending, initialDraft(pending)).patch).toEqual({})
  })

  it("turns addresses into lists and validates them", () => {
    const pending = mail()
    const base = initialDraft(pending)

    expect(
      buildPatch(pending, { ...base, to: "a@b.co; c@d.co,\n e@f.co" }).patch,
    ).toEqual({
      to: ["a@b.co", "c@d.co", "e@f.co"],
    })
    expect(buildPatch(pending, { ...base, cc: "x@y.co" }).patch).toEqual({
      cc: ["x@y.co"],
    })
    expect(
      buildPatch(pending, { ...base, to: "no-es-correo" }).errors.to,
    ).toEqual({
      key: "invalidAddress",
    })
    expect(buildPatch(pending, { ...base, to: "  " }).errors.to).toEqual({
      key: "noRecipients",
    })
    // Clearing the optional list is an empty list, not null (null means "unchanged" on updates).
    const withCc = mail({ action: { ...mail().action, cc: ["x@y.co"] } })
    expect(
      buildPatch(withCc, { ...initialDraft(withCc), cc: "" }).patch,
    ).toEqual({ cc: [] })
  })

  it("does not let a subject or title be emptied, but lets a location be cleared", () => {
    expect(
      buildPatch(mail(), { ...initialDraft(mail()), subject: "  " }).errors
        .subject,
    ).toEqual({
      key: "required",
    })
    const withPlace = event({ location: "Sala 1" })
    expect(
      buildPatch(withPlace, { ...initialDraft(withPlace), location: "" }).patch,
    ).toEqual({
      location: null,
    })
    expect(
      buildPatch(event(), { ...initialDraft(event()), title: "" }).errors.title,
    ).toEqual({
      key: "required",
    })
  })

  it("sends event times with the offset of the action's zone", () => {
    const pending = event()
    const draft = {
      ...initialDraft(pending),
      start: "2027-11-15T11:00",
      end: "2027-11-15T12:00",
    }

    expect(buildPatch(pending, draft)).toEqual({
      patch: {
        start: "2027-11-15T11:00:00+01:00",
        end: "2027-11-15T12:00:00+01:00",
      },
      errors: {},
    })
  })

  it("flags an ambiguous time with the zone, and an end before the start", () => {
    const pending = event()
    const base = initialDraft(pending)

    expect(
      buildPatch(pending, { ...base, start: "2027-10-31T02:30" }).errors.start,
    ).toEqual({
      key: "ambiguousTime",
      zone: "Europe/Madrid",
    })
    expect(
      buildPatch(pending, { ...base, end: "2027-11-15T09:00" }).errors.end,
    ).toEqual({
      key: "endBeforeStart",
    })
    expect(buildPatch(pending, { ...base, start: "" }).errors.start).toEqual({
      key: "invalidDateTime",
    })
  })
})
