# Inventario de Componentes de Chat (NextJS -> Monorepo)

Este documento lista los componentes involucrados en chat en el proyecto NextJS
`/Users/isubero/Documents/sites/plai/plai-ui`, con su estado actual de migracion
al monorepo `ui`.

## Principios de migracion (acordados)

1. `useChat` es la fuente de verdad y la API de alto nivel.
2. Los componentes UI de `@plaisolutions/react` son opcionales.
3. Los componentes migrados deben ser puros (sin side effects de red/sesion).
4. La migracion no es copy/paste: se aprovecha para refactorizar y simplificar.
5. Logica de transporte/sesion/autenticacion permanece en host app, no en componentes UI.

## Criterio de estado

- `Si`: existe componente equivalente en `packages/react`.
- `Parcial`: existe una version base, pero no cubre toda la funcionalidad del original.
- `No`: aun no migrado.

## Estado actual del nucleo

- `useChat`: disponible en `@plaisolutions/react` y considerado estable como API principal.
- Este inventario se enfoca en componentes UI alrededor de `useChat`.

## Componentes (plai-ui/components/chat)
| Componente | Descripcion breve | Ruta en NextJS | Estado en monorepo |
| --- | --- | --- | --- |
| `Chat` | Contenedor principal de conversacion, streaming y render de mensajes | `components/chat/chat.tsx` | `No` |
| `Message` | Render de un mensaje (usuario/asistente), markdown, tool results y acciones | `components/chat/message.tsx` | `Parcial` (`packages/react/src/components/message.tsx`) |
| `PromptForm` | Composer: input, submit, stop, adjuntos, seleccion de tools y voz | `components/chat/prompt-form.tsx` | `Parcial` (`packages/react/src/components/prompt-form.tsx`) |
| `ChatLayout` | Layout general que compone sidebar + chat | `components/chat/chat-layout.tsx` | `No` |
| `ChatSidebar` | Sidebar con conversaciones, nuevo chat, info y controles | `components/chat/chat-sidebar.tsx` | `No` |
| `ChatsList` | Lista/paginacion de threads, buscar, borrar, compartir | `components/chat/chats-list.tsx` | `No` |
| `ThreadFilter` | Input de busqueda para conversaciones | `components/chat/thread-filter.tsx` | `No` |
| `ThreadShareDialog` | Dialogo para compartir thread (crear/renovar link) | `components/chat/thread-share-dialog.tsx` | `No` |
| `Greeting` | Mensaje de bienvenida contextual/embed | `components/chat/greeting.tsx` | `No` |
| `InfoBox` | Dialogo de informacion/help del chat | `components/chat/info-box.tsx` | `No` |
| `CopyrightBox` | Pie de copyright del widget/chat | `components/chat/copyright-box.tsx` | `No` |
| `MessagesSkeleton` | Skeleton de carga para lista de mensajes | `components/chat/messages-skeleton.tsx` | `No` |
| `ChatSkeleton` | Skeleton de carga para layout completo de chat | `components/chat/chat-skeleton.tsx` | `No` |
| `ThreadChatConversation` | Render de una conversacion de thread existente | `components/chat/thread-chat-conversation.tsx` | `No` |
| `ThreadMessageList` | Render de mensajes de thread (incluye bloques y tool_use) | `components/chat/thread-message-list.tsx` | `No` |
| `ShowSourcesButton` | Boton/sheet para agrupar y mostrar fuentes de herramientas | `components/chat/show-sources-button.tsx` | `No` |
| `DocumentCitation` | UI de citas/documentos referenciados en respuestas | `components/chat/document-citation.tsx` | `No` |
| `ExternalDatasourceCard` | Tarjeta para resultados de external datasource (SQL/tabla) | `components/chat/external-datasource-card.tsx` | `No` |
| `ToolUsed` | Indicador visual de herramienta en uso durante streaming | `components/chat/tool-used.tsx` | `No` |
| `Microphone` | Entrada por voz y control de grabacion | `components/chat/microphone.tsx` | `No` |
| `ToolParameterRenderer` | Render de parametros segun schema JSON | `components/chat/tool-parameter-renderer.tsx` | `No` |
| `BoxDrawingRenderer` | Render especializado de diagramas en caracteres box-drawing | `components/chat/box-drawing-renderer.tsx` | `No` |
| `AgentChatTabs` | Tabs de multi-chat por agente | `components/chat/agent-tabs.tsx` | `No` |
| `ChatSessionProvider` | Provider de sesion/contexto de chat | `components/chat/context.tsx` | `No` |
| `MultiChatSessionProvider` | Provider de estado multi-chat/multi-agente | `components/chat/multi-context.tsx` | `No` |

## Tool Results (plai-ui/components/chat/tool-result)
| Componente | Descripcion breve | Ruta en NextJS | Estado en monorepo |
| --- | --- | --- | --- |
| `ToolResultCard` | Router principal de tipos de resultado de tools | `components/chat/tool-result/tool-result-card.tsx` | `Parcial` (`packages/react/src/components/tool-result-card.tsx`) |
| `ToolResultWrapper` | Envoltorio visual comun para cards de tools | `components/chat/tool-result/tool-result-wrapper.tsx` | `No` |
| `ToolResultSheet` | Sheet reutilizable para ver detalles de resultados | `components/chat/tool-result/tool-result-sheet.tsx` | `No` |
| `DatasourceToolResult` | Tarjeta de resultados de datasource/documentos | `components/chat/tool-result/datasource-tool-result.tsx` | `No` |
| `WebSearchCard` | Tarjeta de resultados web/perplexity/firecrawl | `components/chat/tool-result/web-search-card.tsx` | `No` |
| `AggregatedSourceResults` | Agregador de multiples resultados de fuentes | `components/chat/tool-result/aggregated-source-results.tsx` | `No` |
| `ExternalDatasourceCard` | Resultado tabular/query de datasource externo | `components/chat/external-datasource-card.tsx` | `No` |
| `OfficeDocumentsResult` | Resultado para herramientas de office documents | `components/chat/tool-result/office-documents-result.tsx` | `No` |
| `HttpRequestResult` | Resultado para tool de HTTP requests | `components/chat/tool-result/http-request-result.tsx` | `No` |
| `McpToolResult` | Resultado para herramientas MCP remotas | `components/chat/tool-result/mcp-tool-result.tsx` | `No` |
| `WorkflowResult` | Resultado para ejecucion/dispatch de workflows | `components/chat/tool-result/workflow-result.tsx` | `No` |
| `AgentInvocationResult` | Resultado para invocacion de otro agente (sub-conversacion) | `components/chat/tool-result/agent-invocation-result.tsx` | `No` |
| `BrowserResult` | Resultado para tool de browser/scraping | `components/chat/tool-result/browser-result.tsx` | `No` |
| `EmailResult` | Resultado para tool de email | `components/chat/tool-result/email-result.tsx` | `No` |

## Componentes de entrada/pagina que montan chat (Next app)
| Componente | Descripcion breve | Ruta en NextJS | Estado en monorepo |
| --- | --- | --- | --- |
| `ChatPage` | Entry de chat para una sesion/thread | `app/chats/[chatSessionId]/page.tsx` | `No` |
| `ChatEmbedPage` | Entry embed del widget de chat | `app/chats/embed/page.tsx` | `No` |
| `MultiChatShell` | Shell de dashboard para multi-agente | `app/dashboard/[organizationId]/projects/[projectId]/chat/components/multi-chat-shell.tsx` | `No` |
| `ContextualChatView` | Vista contextual para chat de agente en dashboard | `app/dashboard/[organizationId]/projects/[projectId]/agents/[agentId]/chat/components/contextual-chat-view.tsx` | `No` |

## Checklist de calidad por componente migrado

- Mantener API basada en props controladas (sin acoplar transporte/sesion).
- Evitar `useEffect` salvo casos realmente necesarios.
- Sin dependencias directas a `next/*`, cookies o APIs del host.
- Cubrir comportamiento base con tests en `packages/react/src/__tests__`.
- Incluir ejemplo de uso en `examples/react-chat` cuando aporte claridad.
