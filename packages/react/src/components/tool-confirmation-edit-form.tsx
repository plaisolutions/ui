import type { PendingConfirmation } from "@plaisolutions/client"
import { useId } from "react"
import { joinClasses } from "./internal/join-classes"
import {
  type PersonalConnectorCopy,
  fillCopy,
} from "./internal/personal-connector-copy"
import {
  type Draft,
  FIELD_KINDS,
  type FieldError,
  type EditErrorKey,
  actionZone,
  editableFields,
  zoneLabel,
} from "./internal/tool-confirmation-edit"

const LABELS: Record<string, keyof PersonalConnectorCopy> = {
  to: "to",
  cc: "cc",
  subject: "subject",
  body: "fieldBody",
  title: "title",
  start: "fieldStart",
  end: "fieldEnd",
  location: "location",
  attendees: "attendees",
}

const ERROR_COPY: Record<EditErrorKey, keyof PersonalConnectorCopy> = {
  required: "errorRequired",
  noRecipients: "errorNoRecipients",
  invalidAddress: "errorInvalidAddress",
  invalidDateTime: "errorInvalidDateTime",
  ambiguousTime: "errorAmbiguousTime",
  endBeforeStart: "errorEndBeforeStart",
}

const INPUT_CLASS =
  "w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-xs text-foreground disabled:opacity-50 aria-[invalid=true]:border-danger"

export type ToolConfirmationEditFormProps = {
  pending: PendingConfirmation
  draft: Draft
  onChange: (field: string, value: string) => void
  /** Found on this device before sending. */
  errors: Record<string, FieldError>
  /** Sent back by the server for this draft (field → message). */
  serverErrors: Record<string, string>
  disabled?: boolean
  copy: PersonalConnectorCopy
}

/**
 * Inline form to change an action before confirming it. Only the fields the
 * server declared editable are shown. The draft lives in the parent, so it
 * survives validation errors and a busy thread.
 */
export function ToolConfirmationEditForm({
  pending,
  draft,
  onChange,
  errors,
  serverErrors,
  disabled,
  copy,
}: ToolConfirmationEditFormProps) {
  const baseId = useId()
  const fields = editableFields(pending)
  const zone = zoneLabel(actionZone(pending.action as Record<string, unknown>))

  return (
    <div
      className="space-y-2 border-t border-border bg-surface px-3 py-3"
      data-confirmation-edit={pending.action_id}
    >
      {fields.map((field) => {
        const kind = FIELD_KINDS[field]
        const id = `${baseId}-${field}`
        const errorId = `${id}-error`
        const clientError = errors[field]
        const message = clientError
          ? fillCopy(copy[ERROR_COPY[clientError.key]], {
              zone: clientError.zone ?? zone,
            })
          : serverErrors[field]
        const common = {
          id,
          name: field,
          value: draft[field] ?? "",
          disabled,
          "aria-invalid": message ? true : undefined,
          "aria-describedby": message ? errorId : undefined,
          className: INPUT_CLASS,
        } as const
        return (
          <div key={field} className="space-y-1">
            <label
              htmlFor={id}
              className="block text-xs font-medium text-strong"
            >
              {copy[LABELS[field]]}
            </label>
            {kind === "textarea" ? (
              <textarea
                {...common}
                rows={5}
                onChange={(event) => onChange(field, event.target.value)}
              />
            ) : kind === "datetime" ? (
              <input
                {...common}
                type="datetime-local"
                step={60}
                onChange={(event) => onChange(field, event.target.value)}
              />
            ) : (
              <input
                {...common}
                type="text"
                autoComplete="off"
                onChange={(event) => onChange(field, event.target.value)}
              />
            )}
            {kind === "addresses" ? (
              <p className="text-xs text-muted">{copy.addressesHint}</p>
            ) : null}
            {kind === "datetime" ? (
              <p className="text-xs text-muted">
                {fillCopy(copy.timeZoneNote, { zone })}
              </p>
            ) : null}
            {message ? (
              <p
                id={errorId}
                role="alert"
                className={joinClasses("text-xs text-danger-strong")}
              >
                {message}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
