import type { UIExternalDatasourceToolCallPart } from "@plaisolutions/client"
import { CheckCircle2, Database, XCircle } from "lucide-react"
import { formatToolErrorDetails } from "./internal/format-tool-error-details"
import { joinClasses } from "./internal/join-classes"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"

export type ToolResultExternalDatasourceCardProps = {
  part: UIExternalDatasourceToolCallPart
  className?: string
}

type NormalizedTable = {
  columns: string[]
  rows: unknown[][]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "-"
  }
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function normalizeTable(value: unknown): NormalizedTable {
  const raw = typeof value === "string" ? parseJson(value) : value
  if (!raw) {
    return { columns: [], rows: [] }
  }

  if (Array.isArray(raw)) {
    const records = raw.filter(isRecord)
    const columns = Array.from(
      new Set(records.flatMap((record) => Object.keys(record))),
    )
    return {
      columns,
      rows: records.map((record) => columns.map((column) => record[column])),
    }
  }

  if (!isRecord(raw)) {
    return { columns: [], rows: [] }
  }

  if (Array.isArray(raw.columns) && Array.isArray(raw.rows)) {
    const columns = raw.columns.filter(
      (column): column is string => typeof column === "string",
    )
    const rows = raw.rows.map((row) => (Array.isArray(row) ? row : [row]))
    return { columns, rows }
  }

  const columns = Object.keys(raw)
  if (columns.length === 0) {
    return { columns: [], rows: [] }
  }

  const columnValues = columns.map((column) => raw[column])
  const isColumnOriented = columnValues.some(isRecord)
  if (!isColumnOriented) {
    return {
      columns: ["Property", "Value"],
      rows: Object.entries(raw),
    }
  }

  const rowKeys = Array.from(
    new Set(
      columnValues.flatMap((column) =>
        isRecord(column) ? Object.keys(column) : [],
      ),
    ),
  )
  return {
    columns,
    rows: rowKeys.map((rowKey) =>
      columnValues.map((column) => (isRecord(column) ? column[rowKey] : null)),
    ),
  }
}

function getTableValue(part: UIExternalDatasourceToolCallPart): unknown {
  if (part.metadata?.json_table !== undefined) {
    return part.metadata.json_table
  }

  return typeof part.result === "string" ? part.result : null
}

function formatStatus(state: UIExternalDatasourceToolCallPart["state"]) {
  if (state === "pending") return "pending"
  if (state === "error") return "error"
  return "completed"
}

export function ToolResultExternalDatasourceCard({
  part,
  className,
}: ToolResultExternalDatasourceCardProps) {
  const sqlQuery = toStringOrNull(part.metadata?.sql_query)
  const table = normalizeTable(getTableValue(part))
  const errorDetails = formatToolErrorDetails(part.errorDetails)
  const statusClass =
    part.state === "error"
      ? "text-rose-600"
      : part.state === "pending"
        ? "text-amber-600"
        : "text-emerald-600"

  return (
    <Sheet>
      <SheetTrigger
        aria-label={`External datasource: ${formatStatus(part.state)}`}
        className={joinClasses(
          "w-full overflow-hidden rounded-lg border border-neutral-200 bg-white text-left font-normal text-neutral-950 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950",
          className,
        )}
      >
        <span className="flex items-center gap-2 px-3 py-2 text-sm">
          <Database
            className="h-4 w-4 shrink-0 text-neutral-500"
            aria-hidden="true"
          />
          <span className="truncate font-medium">External datasource</span>
          <span className={joinClasses("ml-auto shrink-0", statusClass)}>
            {part.state === "error" ? (
              <XCircle className="h-4 w-4" aria-hidden="true" />
            ) : part.state === "completed" ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <span className="text-xs">pending</span>
            )}
          </span>
        </span>
      </SheetTrigger>

      <SheetContent closeLabel="Close">
        <SheetHeader className="pr-10">
          <SheetTitle>External datasource</SheetTitle>
        </SheetHeader>

        <section
          className="mt-6 space-y-8"
          aria-label="External datasource result"
        >
          {sqlQuery ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database
                  className="h-5 w-5 text-blue-500"
                  aria-hidden="true"
                />
                <h3 className="text-sm font-medium">SQL query</h3>
              </div>
              <pre className="overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs leading-5 text-neutral-800">
                {sqlQuery}
              </pre>
            </div>
          ) : null}

          {table.columns.length > 0 && table.rows.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Query results</h3>
              <div className="overflow-x-auto rounded-md border border-neutral-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600">
                    <tr>
                      {table.columns.map((column) => (
                        <th
                          key={column}
                          className="max-w-56 truncate border-b border-neutral-200 px-3 py-2 font-medium"
                          title={column}
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr
                        key={row.map(formatCell).join("\u0000")}
                        className="border-b border-neutral-100 last:border-0"
                      >
                        {table.columns.map((column, columnIndex) => {
                          const value = formatCell(row[columnIndex])
                          return (
                            <td
                              key={column}
                              className="max-w-56 truncate px-3 py-2 text-neutral-700"
                              title={value}
                            >
                              {value}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : part.state === "completed" && !errorDetails ? (
            <p className="text-sm text-neutral-600">No data to display.</p>
          ) : null}

          {errorDetails ? (
            <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <span className="font-semibold">Error details:</span>{" "}
              {errorDetails}
            </p>
          ) : null}
        </section>
      </SheetContent>
    </Sheet>
  )
}
