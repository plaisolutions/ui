import { type SupportedToolLocale, getSupportedToolLocale } from "./tool-locale"

type SourceResultsCopy = {
  webSearchTitle: string
  singularSource: string
  pluralSources: string
}

const ENGLISH_SOURCE_RESULTS_COPY: SourceResultsCopy = {
  webSearchTitle: "Internet search results",
  singularSource: "source",
  pluralSources: "sources",
}

const SOURCE_RESULTS_COPY: Record<
  SupportedToolLocale,
  Partial<SourceResultsCopy>
> = {
  en: {},
  es: {
    webSearchTitle: "Resultados de búsqueda en Internet",
    singularSource: "fuente",
    pluralSources: "fuentes",
  },
  ca: {
    webSearchTitle: "Resultats de cerca a Internet",
    singularSource: "font",
    pluralSources: "fonts",
  },
  fr: {
    webSearchTitle: "Résultats de recherche sur Internet",
    singularSource: "source",
    pluralSources: "sources",
  },
  it: {
    webSearchTitle: "Risultati della ricerca su Internet",
    singularSource: "fonte",
    pluralSources: "fonti",
  },
  de: {
    webSearchTitle: "Ergebnisse der Internetsuche",
    singularSource: "Quelle",
    pluralSources: "Quellen",
  },
  da: {
    webSearchTitle: "Resultater fra internetsøgning",
    singularSource: "kilde",
    pluralSources: "kilder",
  },
  sv: {
    webSearchTitle: "Resultat från internetsökning",
    singularSource: "källa",
    pluralSources: "källor",
  },
  no: {
    webSearchTitle: "Resultater fra internettsøk",
    singularSource: "kilde",
    pluralSources: "kilder",
  },
  pt: {
    webSearchTitle: "Resultados da pesquisa na Internet",
    singularSource: "fonte",
    pluralSources: "fontes",
  },
}

export function getSourceResultsCopy(locale?: string | null) {
  return {
    ...ENGLISH_SOURCE_RESULTS_COPY,
    ...SOURCE_RESULTS_COPY[getSupportedToolLocale(locale)],
  }
}
