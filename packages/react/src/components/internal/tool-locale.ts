export type SupportedToolLocale =
  | "ca"
  | "da"
  | "de"
  | "en"
  | "es"
  | "fr"
  | "it"
  | "no"
  | "pt"
  | "sv"

const SUPPORTED_TOOL_LOCALES = new Set<SupportedToolLocale>([
  "ca",
  "da",
  "de",
  "en",
  "es",
  "fr",
  "it",
  "no",
  "pt",
  "sv",
])

function getCurrentLocale() {
  return typeof navigator === "undefined" ? "en" : navigator.language
}

export function getSupportedToolLocale(
  locale?: string | null,
): SupportedToolLocale {
  const language = (locale ?? getCurrentLocale())
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0]
  const normalizedLanguage =
    language === "nb" || language === "nn" ? "no" : language

  return SUPPORTED_TOOL_LOCALES.has(normalizedLanguage as SupportedToolLocale)
    ? (normalizedLanguage as SupportedToolLocale)
    : "en"
}
