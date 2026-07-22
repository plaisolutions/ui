import type { ResourceReadModel } from "@plaisolutions/client"

export type OpenGraphField = "title" | "description" | "url" | "image" | "type"

export type OpenGraphTranslation = Partial<Record<OpenGraphField, string>>

export type LocalizedOpenGraph = OpenGraphTranslation & {
  defaultLocale?: string
  translations?: Record<string, OpenGraphTranslation>
}

export type OpenGraphContainer = {
  extra_info?:
    | (Record<string, unknown> & {
        opengraph?: LocalizedOpenGraph
      })
    | null
}

function normalizeLocale(locale?: string | null) {
  return locale?.trim().toLowerCase()
}

function getCurrentLocale() {
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return document.documentElement.lang
  }
  if (typeof navigator !== "undefined") {
    return (
      navigator.language ||
      (navigator as Navigator & { userLanguage?: string }).userLanguage
    )
  }
  return undefined
}

function getLocaleCandidates(locale?: string | null) {
  const normalized = normalizeLocale(locale)
  if (!normalized) return []
  const [language] = normalized.split("-")
  return language === normalized ? [normalized] : [normalized, language]
}

function hasStringValue(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function getTranslation(
  translations: LocalizedOpenGraph["translations"],
  locale: string,
) {
  if (!translations) return undefined
  return Object.entries(translations).find(
    ([translationLocale]) => normalizeLocale(translationLocale) === locale,
  )?.[1]
}

export function getLocalizedOpenGraphValue(
  container: OpenGraphContainer,
  field: OpenGraphField,
  locale?: string | null,
) {
  const opengraph = container.extra_info?.opengraph
  if (!opengraph) return undefined

  for (const candidate of getLocaleCandidates(locale ?? getCurrentLocale())) {
    const translated = getTranslation(opengraph.translations, candidate)?.[
      field
    ]
    if (hasStringValue(translated)) return translated.trim()
  }

  const fallback = opengraph[field]
  return hasStringValue(fallback) ? fallback.trim() : undefined
}

export function getResourceTitle(
  resource: ResourceReadModel,
  locale?: string | null,
) {
  return getLocalizedOpenGraphValue(resource, "title", locale) ?? resource.name
}

export function getResourceDescription(
  resource: ResourceReadModel,
  locale?: string | null,
) {
  return (
    getLocalizedOpenGraphValue(resource, "description", locale) ??
    resource.summary ??
    resource.content ??
    undefined
  )
}

export function getResourceOpenGraphImage(
  resource: ResourceReadModel,
  locale?: string | null,
) {
  return getLocalizedOpenGraphValue(resource, "image", locale)
}

export function getResourceOpenGraphType(
  resource: ResourceReadModel,
  locale?: string | null,
) {
  return getLocalizedOpenGraphValue(resource, "type", locale)
}

function readNestedString(
  records: Array<Record<string, unknown> | undefined>,
  path: string[],
) {
  for (const record of records) {
    let current: unknown = record
    for (const key of path) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        current = undefined
        break
      }
      current = (current as Record<string, unknown>)[key]
    }
    if (hasStringValue(current)) return current.trim()
  }
  return undefined
}

function isGoogleDriveUrl(url?: string | null) {
  if (!url) return false
  try {
    const hostname = new URL(url).hostname
    return hostname === "drive.google.com" || hostname.endsWith(".google.com")
  } catch {
    return false
  }
}

function isGoogleDriveResource(resource: ResourceReadModel) {
  const records = [resource.extra_info, resource.metadata]
  const candidates = [
    resource.datasource?.source,
    readNestedString(records, ["datasource_source"]),
    readNestedString(records, ["source"]),
    readNestedString(records, ["origin"]),
    readNestedString(records, ["datasource", "source"]),
    readNestedString(records, ["datasource", "origin"]),
  ]
  return (
    candidates.some(
      (candidate) => candidate?.toUpperCase() === "GOOGLE_DRIVE",
    ) ||
    isGoogleDriveUrl(resource.external_url) ||
    isGoogleDriveUrl(resource.url)
  )
}

export function getResourceUrl(
  resource: ResourceReadModel,
  locale?: string | null,
) {
  const openGraphUrl = getLocalizedOpenGraphValue(resource, "url", locale)
  if (openGraphUrl) return openGraphUrl
  if (isGoogleDriveResource(resource)) {
    return resource.url ?? resource.external_url
  }
  return resource.external_url ?? resource.url
}

export function getResourceType(
  resource: ResourceReadModel,
  locale?: string | null,
) {
  const openGraphType = getResourceOpenGraphType(resource, locale)
  if (openGraphType) return openGraphType
  if (resource.type?.trim()) {
    return resource.type.charAt(0).toUpperCase() + resource.type.slice(1)
  }

  const metadataType = resource.metadata.type
  if (hasStringValue(metadataType)) {
    return metadataType.charAt(0).toUpperCase() + metadataType.slice(1)
  }

  const url = resource.url ?? resource.external_url ?? ""
  if (/\.pdf(?:$|[?#])/i.test(url)) return "PDF"
  if (/\.docx?(?:$|[?#])/i.test(url)) return "Document"
  if (/\.xlsx?(?:$|[?#])/i.test(url)) return "Spreadsheet"
  if (/\.pptx?(?:$|[?#])/i.test(url)) return "Presentation"
  if (/\.(?:jpe?g|png|gif|webp)(?:$|[?#])/i.test(url)) return "Image"
  if (/\.(?:mp4|mov|avi)(?:$|[?#])/i.test(url)) return "Video"
  if (/^https?:\/\//i.test(url)) return "Webpage"

  return "Document"
}

export function getResourceIcon(
  resource: ResourceReadModel,
  locale?: string | null,
) {
  return (
    getResourceOpenGraphImage(resource, locale) ??
    readNestedString([resource.extra_info], ["icon"]) ??
    readNestedString([resource.metadata], ["icon"])
  )
}
