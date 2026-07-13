export function formatToolErrorDetails(value: unknown): string | null {
  if (typeof value === "string") {
    return value
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value == null ? null : String(value)
  }

  const details = value as Record<string, unknown>
  for (const key of ["error_message", "message", "detail"]) {
    const candidate = details[key]
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate
    }
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return "Unknown tool error"
  }
}
