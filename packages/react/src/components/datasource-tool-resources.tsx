import type { FolderReadModel, ResourceReadModel } from "@plaisolutions/client"
import {
  DatasourceFolderCard,
  type DatasourceFolderCardProps,
} from "./datasource-folder-card"
import { joinClasses } from "./internal/join-classes"
import {
  getLocalizedOpenGraphValue,
  getResourceDescription,
  getResourceIcon,
  getResourceTitle,
  getResourceType,
  getResourceUrl,
} from "./opengraph"
import { ResourceCard, type ResourceCardProps } from "./resource-card"

export type DatasourceToolResourcesProps = {
  resources: ResourceReadModel[]
  locale?: string | null
  className?: string
}

export type DatasourceResourceCard =
  | {
      kind: "folder"
      key: string
      props: DatasourceFolderCardProps
    }
  | {
      kind: "resource"
      key: string
      props: ResourceCardProps
    }

type FolderGroup = {
  folder: FolderReadModel
  resources: ResourceReadModel[]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readString(value: Record<string, unknown> | undefined, key: string) {
  const candidate = value?.[key]
  return typeof candidate === "string" && candidate.trim() ? candidate : null
}

function toResourceCardProps(
  resource: ResourceReadModel,
  locale?: string | null,
): ResourceCardProps {
  return {
    icon: getResourceIcon(resource, locale),
    type: getResourceType(resource, locale),
    title: getResourceTitle(resource, locale),
    description: getResourceDescription(resource, locale),
    url: getResourceUrl(resource, locale),
  }
}

function toFolderCardProps(
  folder: FolderReadModel,
  group: ResourceReadModel[],
  locale?: string | null,
): DatasourceFolderCardProps {
  const datasource = group[0]?.datasource
  const type =
    getLocalizedOpenGraphValue(folder, "type", locale) ??
    readString(folder.extra_info, "type") ??
    datasource?.type ??
    "FOLDER"

  return {
    icon: getLocalizedOpenGraphValue(folder, "image", locale) ?? undefined,
    title:
      getLocalizedOpenGraphValue(folder, "title", locale) ?? folder.name,
    description:
      getLocalizedOpenGraphValue(folder, "description", locale) ??
      readString(folder.extra_info, "description") ??
      readString(folder.extra_info, "summary") ??
      datasource?.description ??
      datasource?.summary ??
      "",
    type,
    url: getLocalizedOpenGraphValue(folder, "url", locale),
    resources: group.map((resource) =>
      toResourceCardProps(resource, locale),
    ),
  }
}

export function isDatasourceResource(
  value: unknown,
): value is ResourceReadModel {
  if (!isObject(value)) {
    return false
  }

  const folder = value.folder
  const datasource = value.datasource

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    (value.url === null || typeof value.url === "string") &&
    (value.external_url === null || typeof value.external_url === "string") &&
    isObject(value.metadata) &&
    isObject(value.extra_info) &&
    (folder === null ||
      (isObject(folder) &&
        typeof folder.id === "string" &&
        typeof folder.name === "string" &&
        isObject(folder.extra_info))) &&
    (datasource === null ||
      (isObject(datasource) &&
        typeof datasource.type === "string" &&
        (datasource.description === null ||
          typeof datasource.description === "string") &&
        (datasource.summary === null ||
          typeof datasource.summary === "string")))
  )
}

export function getDatasourceResourceCards(
  resources: ResourceReadModel[],
  locale?: string | null,
): DatasourceResourceCard[] {
  const folderGroups = new Map<string, FolderGroup>()
  const ungroupedResources: ResourceReadModel[] = []
  const seenUrls = new Set<string>()

  for (const resource of resources) {
    if (resource.extra_info.public === false) continue

    const resourceUrl = getResourceUrl(resource, locale)
    if (resourceUrl) {
      if (seenUrls.has(resourceUrl)) continue
      seenUrls.add(resourceUrl)
    }

    if (!resource.folder) {
      ungroupedResources.push(resource)
      continue
    }

    const existingGroup = folderGroups.get(resource.folder.id)
    if (existingGroup) {
      existingGroup.resources.push(resource)
    } else {
      folderGroups.set(resource.folder.id, {
        folder: resource.folder,
        resources: [resource],
      })
    }
  }

  return [
    ...Array.from(folderGroups.values()).map(({ folder, resources: group }) => ({
      kind: "folder" as const,
      key: `folder-${folder.id}`,
      props: toFolderCardProps(folder, group, locale),
    })),
    ...ungroupedResources.map((resource) => ({
      kind: "resource" as const,
      key: `resource-${resource.id}`,
      props: toResourceCardProps(resource, locale),
    })),
  ]
}

export function DatasourceResourceCardView({
  card,
  variant = "card",
}: {
  card: DatasourceResourceCard
  variant?: "card" | "list"
}) {
  if (card.kind === "folder") {
    return <DatasourceFolderCard {...card.props} variant={variant} />
  }

  return <ResourceCard {...card.props} variant={variant} />
}

export function DatasourceToolResources({
  resources,
  locale,
  className,
}: DatasourceToolResourcesProps) {
  const cards = getDatasourceResourceCards(resources, locale)

  return (
    <section
      aria-label="Recursos de la fuente de datos"
      className={joinClasses("flex flex-wrap gap-3", className)}
    >
      {cards.map((card) => (
        <DatasourceResourceCardView key={card.key} card={card} />
      ))}
    </section>
  )
}
