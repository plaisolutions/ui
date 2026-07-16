# Roadmap de subcomponentes de Tool Results

Este documento es la referencia de estado para los renderizadores especializados
de resultados de tools en `@plaisolutions/react`.

Su fuente de verdad es `UIToolType` en
[`packages/client/src/types.ts`](../packages/client/src/types.ts). Un tipo puede
estar **soportado** por `ToolResultCard` mediante su fallback genérico, pero no
por ello tener todavía una UI especializada.

## Estados

- **Implementado**: existe un subcomponente dedicado y `ToolResultCard` lo usa.
- **Parcial**: hay tratamiento específico dentro del fallback genérico, pero no
  un subcomponente dedicado.
- **Pendiente**: por ahora se muestra solo con el fallback genérico.

## Infraestructura común

| Elemento | Estado | Implementación actual | Siguiente trabajo |
| --- | --- | --- | --- |
| Router de resultados | Parcial | `ToolResultCard` selecciona la card de `email_send`, los recursos de `datasource` y aplica un fallback JSON para el resto. | Convertir las ramas especializadas restantes en subcomponentes. |
| Wrapper visual común | Pendiente | Cada card controla actualmente su propio contenedor y estados. | Extraer una envoltura común de estado, cabecera y acciones cuando haya suficientes cards que justifiquen la API. |
| Panel de detalles reutilizable | Pendiente | Se usan `<details>` en el fallback y estado local en email. | Definir una experiencia común de detalle (por ejemplo, sheet o acordeón) antes de duplicarla en nuevas cards. |
| Fallback genérico | Implementado | Muestra nombre, estado, tipo, input, output, errores y archivos de Office. | Mantenerlo como red de seguridad para tipos desconocidos o contratos aún no tipados. |

## Mapa por `toolType`

| `toolType` | Estado | UI actual | Alcance pendiente / siguiente subcomponente |
| --- | --- | --- | --- |
| `datasource` | Implementado | `DatasourceToolResources` agrupa `metadata.resources` por carpeta y usa `DatasourceToolResultCard`, `DatasourceFolderCard` y `ResourceCard`. | Cubrir de forma especializada los resultados sin `resources`, si el contrato de producto los requiere. |
| `email_send` | Implementado | `ToolResultEmailSendCard` muestra asunto, destinatarios, cuerpo desplegable, entrega y recibo. | Exportar la card como API pública y añadir story/test directo si se desea que se consuma fuera del router. |
| `office_documents` | Implementado | `ToolResultOfficeDocumentsCard` usa un trigger compacto y un sheet de archivos generados con enlaces de descarga. | Añadir acciones específicas por formato si el producto las requiere. |
| `perplexity` | Implementado | `ToolResultWebSearchCard` muestra el preview `WEB` / `Internet search results` / número de fuentes y abre un sheet con las fuentes. | Mantener el contrato de metadata y revisar mejoras visuales compartidas cuando exista el panel de detalles común. |
| `firecrawl_search` | Implementado | Reutiliza el mismo preview y sheet; los ítems muestran bucket (`web`, `news` o `images`), snippets e imágenes cuando existan. | Mantener el contrato de metadata y revisar mejoras visuales compartidas cuando exista el panel de detalles común. |
| `external_datasource` | Implementado | `ToolResultExternalDatasourceCard` usa un trigger compacto y un sheet con la consulta SQL y los resultados tabulares. | Mantener la normalización de tablas y evaluar acciones opcionales de copiado/exportación cuando estén justificadas. |
| `structured_datasource` | Pendiente | Fallback JSON. | Se mantiene con el fallback genérico; no requiere card dedicada mientras el backend solo exponga una respuesta textual. |
| `http_request` | Implementado | `ToolResultHttpRequestCard` muestra método, URL, código HTTP, cuerpo y headers en un sheet. | Mantener el contrato enriquecido del backend. |
| `mcp_tool` | Implementado | `ToolResultMcpCard` muestra servidor, tool y salida en un sheet; admite los nombres actuales y heredados del metadata. | Mantener la compatibilidad mientras el backend unifica nombres. |
| `workflow_dispatch` | Implementado | `ToolResultWorkflowDispatchCard` muestra workflow, estado e identificadores de ejecución en un sheet. | Añadir enlace de seguimiento cuando el backend exponga una URL de ejecución. |
| `agent_invocation` | Pendiente | Fallback JSON. | `AgentInvocationToolResultCard`: agente invocado, resultado/resumen y acceso a la sub-conversación si el backend lo facilita. |
| `browser` | Pendiente | Fallback JSON. | `BrowserToolResultCard`: acción, URL, título, extracto/captura y posibles enlaces. |
| `unknown` o `null` | Implementado (fallback) | Fallback genérico sin asumir contrato. | No requiere card propia; actualizar `UIToolType` y este mapa al aparecer un nuevo tipo estable. |

## Orden propuesto de implementación

El orden se basa en la posibilidad de reutilizar UI y en el valor de sustituir
JSON por información escaneable:

1. **Office documents**: reemplazar el tratamiento parcial actual por una card
   dedicada de archivos generados.
2. **Integraciones operativas**: `http_request`, `workflow_dispatch` y
   `mcp_tool`.
3. **Ejecución delegada**: `agent_invocation` y `browser`, una vez definidos
   los enlaces o artefactos que cada backend expone.

## Contrato validado: búsqueda web

Verificado contra el backend el 2026-07-15. Las herramientas construyen los
resultados estructurados y el adaptador SSE los reenvía como `metadata` sin
transformarlos:

| Tool | `metadata` recibido por UI |
| --- | --- |
| `perplexity` | `type`, `search_results[]` (`title`, `url`, `date`, `last_updated`, `snippet`) y contadores de uso opcionales. |
| `firecrawl_search` | `type`, `search_results[]` (`source`, `title`, `url`, `snippet`, `markdown`, `image_url`), `credits`, `results_count` y `sources`. |

La procedencia es `app/tools/perplexity.py` y
`app/tools/firecrawl_search.py`; `get_tool_result_extra_info` serializa los
dataclasses y `sse_event_adapter.py` los emite en el evento `tool_result`.
`tool_type` se resuelve desde el registro de tools, con `metadata.type` como
fallback. Por ello los literales de `UIToolType` son confiables para estos dos
tools. Los metadatos, antes genéricos en el cliente, quedan tipados ahora como
`PerplexityToolResultMetadata` y `FirecrawlSearchToolResultMetadata`.

El parser SSE valida el tipo de evento y que el payload sea JSON, pero no hace
validación profunda del metadata en runtime. La card filtra cada resultado antes
de renderizarlo y conserva el fallback de citas históricas; los tipos describen
el contrato de backend, no sustituyen esa protección en el borde de red.

## Contrato validado: datasource externo

Verificado contra `app/tools/external_datasource.py` el 2026-07-15. El backend
emite `sql_query`, `prompt_tokens`, `completion_tokens` y `json_table` dentro
de metadata. `json_table` suele ser un objeto columnar de pandas
(`{ columna: { índice: valor } }`), aunque la card también acepta la forma
explícita `{ columns, rows }`, arrays de objetos y JSON serializado para
resultados almacenados de versiones anteriores.


## Criterio de finalización para cada card

Una card puede marcarse como **Implementado** cuando cumple todos estos puntos:

- `ToolResultCard` delega ese `toolType` a la card dedicada.
- Renderiza `pending`, `completed` y `error` sin perder `errorDetails`.
- Expone la información útil del contrato sin depender de JSON bruto para el
  caso normal.
- Conserva una degradación segura cuando lleguen campos desconocidos o falten
  campos opcionales.
- Tiene test de renderizado y una story representativa cuando aplique.
- Se exporta desde `packages/react/src/components/index.ts` si forma parte de
  la API pública del paquete.

## Mantenimiento

Al añadir un nuevo literal a `UIToolType`, añadir aquí una fila en estado
**Pendiente** durante el mismo cambio. Al implementar una card, actualizar su
estado, su ruta de renderizado y el siguiente trabajo antes de continuar con el
siguiente tipo.
