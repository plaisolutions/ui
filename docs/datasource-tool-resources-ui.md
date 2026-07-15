# Datasource Tool Resources for UI

## Summary

Datasource tool results now return resource context in a top-level `resources`
collection. `documents_metadata` remains the original metadata for each retrieved
chunk and is no longer enriched with embedded `resource` or `datasource` objects.

This avoids duplicating the same resource data for every chunk that belongs to it.

## Result Metadata Contract

```ts
interface DatasourceToolResultMetadata {
  documents_metadata: DocumentMetadata[];
  chunk_ids: string[] | null;
  relevance_scores: number[] | null;
  resources: ResourceReadModel[];
}

interface DocumentMetadata {
  id?: string;
  resource_id?: string;
  datasource_id?: string;
  [key: string]: unknown;
}

interface ResourceReadModel {
  id: string;
  name: string;
  type: string;
  status: string;
  url: string | null;
  content: string | null;
  metadata: Record<string, string | number | boolean>;
  extra_info: Record<string, unknown>;
  folder: FolderReadModel | null;
  datasource: DatasourceReadModel | null;
  external_url: string | null;
  external_resource_id: string | null;
  store: boolean;
  created_at: string;
  updated_at: string;
}

interface FolderReadModel {
  id: string;
  name: string;
  parent_id: string | null;
  datasource_id: string;
  extra_info: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  parent: FolderReadModel | null;
}

interface DatasourceReadModel {
  id: string;
  name: string;
  description: string | null;
  summary: string | null;
  type: string;
  source: string;
  metadata_schema: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
```

`folder.parent` contains at most one level of parent folder. Datetimes are ISO
8601 strings in serialized API responses.

## Example

```json
{
  "documents_metadata": [
    {
      "id": "chunk-1",
      "resource_id": "resource-1",
      "datasource_id": "datasource-1",
      "page": 4
    }
  ],
  "resources": [
    {
      "id": "resource-1",
      "name": "Employee handbook",
      "type": "PDF",
      "status": "DONE",
      "url": null,
      "content": null,
      "metadata": {},
      "extra_info": {},
      "folder": {
        "id": "folder-1",
        "name": "Human Resources",
        "parent_id": null,
        "datasource_id": "datasource-1",
        "extra_info": {},
        "created_at": "2026-07-01T10:00:00",
        "updated_at": "2026-07-01T10:00:00",
        "parent": null
      },
      "datasource": {
        "id": "datasource-1",
        "name": "Company documents",
        "description": "Internal documentation",
        "summary": null,
        "type": "UNSTRUCTURED",
        "source": "MANUAL",
        "metadata_schema": null,
        "created_at": "2026-07-01T10:00:00",
        "updated_at": "2026-07-01T10:00:00"
      },
      "external_url": null,
      "external_resource_id": null,
      "store": true,
      "created_at": "2026-07-01T10:00:00",
      "updated_at": "2026-07-01T10:00:00"
    }
  ]
}
```



## Where to Read It

During SSE streaming, datasource tool data is available in the `tool_result`
event metadata:

```ts
event.metadata.documents_metadata;
event.metadata.resources;
```

When retrieving a thread, the same data is available in both canonical response
shapes:

```ts
message.content_parts[].metadata.documents_metadata;
message.content_parts[].metadata.resources;

message.content_blocks[].tool_info.metadata.documents_metadata;
message.content_blocks[].tool_info.metadata.resources;
```



## UI Integration

Link chunks to their resource using `resource_id`:

```ts
const resourcesById = new Map(
  metadata.resources.map((resource) => [resource.id, resource]),
);

const resource = document.resource_id
  ? resourcesById.get(document.resource_id)
  : undefined;
```

Always handle `resource`, `resource.folder`, `resource.folder.parent`, and
`resource.datasource` as nullable.

## Breaking Change

Do not read these removed nested properties:

```ts
documents_metadata[].resource;
documents_metadata[].datasource;
```

Use `resources` and correlate it with `documents_metadata[].resource_id` instead.

Historical datasource tool results are normalized by the corresponding database
migration.