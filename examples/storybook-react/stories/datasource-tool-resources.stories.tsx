import type { ResourceReadModel } from "@plaisolutions/client"
import { DatasourceToolResources } from "@plaisolutions/react/components"
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta<typeof DatasourceToolResources> = {
  title: "Components/DatasourceToolResources",
  component: DatasourceToolResources,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
}

export default meta

type Story = StoryObj<typeof DatasourceToolResources>

const baseResource: ResourceReadModel = {
  id: "resource-1",
  name: "15. Conceptos clave de Storyline 360",
  type: "SCORM",
  status: "DONE",
  url: null,
  content: null,
  metadata: {},
  extra_info: {},
  folder: {
    id: "folder-course",
    name: "Programa en Diseño Elearning e Innovación",
    parent_id: null,
    datasource_id: "datasource-course",
    extra_info: {
      type: "COURSE",
      description: "En este curso aprenderás los principios básicos de diseño.",
    },
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:00:00Z",
    parent: null,
  },
  datasource: {
    id: "datasource-course",
    name: "Courses",
    description: "Course resources",
    summary: null,
    type: "UNSTRUCTURED",
    source: "MANUAL",
    metadata_schema: null,
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:00:00Z",
  },
  external_url: "https://example.com/resource-1",
  external_resource_id: null,
  store: true,
  created_at: "2026-07-01T10:00:00Z",
  updated_at: "2026-07-01T10:00:00Z",
}

export const GroupedByFolder: Story = {
  args: {
    resources: [
      baseResource,
      {
        ...baseResource,
        id: "resource-2",
        name: "18. Componentes básicos de Storyline 360: Estados",
        external_url: "https://example.com/resource-2",
      },
      {
        ...baseResource,
        id: "resource-3",
        name: "20. Componentes básicos de Storyline 360: Accionadores",
        external_url: "https://example.com/resource-3",
      },
      {
        ...baseResource,
        id: "resource-4",
        name: "19. Componentes básicos de Storyline 360: Capas",
        external_url: "https://example.com/resource-4",
      },
    ],
  },
}

export const UngroupedResources: Story = {
  args: {
    resources: [
      {
        ...baseResource,
        id: "resource-ungrouped-1",
        folder: null,
        extra_info: {
          opengraph: {
            title: "Accessibility checklist",
            description: "A practical WCAG checklist for course authors.",
            type: "GUIDE",
            image: "/favicon.svg",
            url: "https://example.com/accessibility",
          },
        },
      },
      {
        ...baseResource,
        id: "resource-ungrouped-2",
        folder: null,
        name: "Storyline shortcuts",
        external_url: null,
      },
    ],
  },
}

export const Empty: Story = {
  args: { resources: [] },
}
