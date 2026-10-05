# Especificación: un turno del agente = una respuesta en la UI

**Destinatarios:** equipo de backend (agente, endpoint `invoke` e historial del hilo) y equipo del SDK (`@plaisolutions/client`, `@plaisolutions/react`).
**Estado:** P1/P2/P3 implementados y comprobados localmente. A8 requiere un entorno y agente reales; no se ha publicado ni desplegado.

---

## 1. Problema

En conversaciones donde el agente usa tools (por ejemplo, el datasource `plai_framework_documents`), el usuario ve:

1. **Texto duplicado:** el modelo empieza a escribir la respuesta final ("# Información de Modelos LLM… TABLA 1…"), a mitad llama a una tool y, con el resultado, vuelve a escribir la respuesta desde el principio.
2. **Botones (copiar, 👍/👎, recargar) en medio de la respuesta:** aparecen una vez tras el primer fragmento y otra vez al final.

### Stream capturado

Es una respuesta real, con los `content_block_delta` resumidos:

```
content_block_start  index 0  thinking   … "Con esto tengo suficiente para armar las dos tablas"
content_block_stop   index 0
content_block_start  index 1  text       "# Información de Modelos LLM y Backend PLai Framework
                                          Basándome en los documentos… ## **TABLA 1: MODELOS LLM…**"   ← se corta aquí
content_block_stop   index 1
content_block_start  index 2  tool_use   plai_framework_documents (datasource)
content_block_stop   index 2
tool_result          toolu_01RdAaSR8wXgRfKwFBuNtZma
content_block_start  index 3  text       "Basándome en los documentos… ## **TABLA 1: …**" + tabla completa,
                                          TABLA 2, configuración recomendada, resumen
content_block_stop   index 3
message_id           3890a02a-e775-4173-9323-dbf91b0b17f5
usage                input 351627 / output 4285
message_stop
```

**Qué muestra:**

- Hay **un solo** `message_id`, un solo `usage` y un solo `message_stop`. Los `index` van seguidos (0 → 3).
- No hay ningún `message_start` / `message_stop` entre las vueltas del agente. **El stream cumple el contrato documentado**.
- La captura no incluye `message_start`, pero `plai-api` lo emite siempre como primer evento: `PlaiOrchestrator.stream` (`src/application/agent_runtime/plai_orchestrator.py`) lo envía antes de ejecutar el agente. Lo que se ignora es el `message_start` de cada vuelta del SDK (`SseEventAdapter._on_message_start`), que es lo correcto. Seguramente la captura empezó tarde.
- El bloque 1 y el bloque 3 empiezan con el mismo texto. **La duplicación la genera el modelo.** El runner (`src/agents_sdk/application/runner.py`) añade el mensaje completo de la vuelta 1 (incluido el texto del bloque 1) a la conversación antes de la vuelta 2. O sea, el modelo **sí ve** lo que ya escribió y aun así lo repite.

### Diagnóstico corregido por host

- **Modelo:** el texto anterior a una tool puede ser un borrador de la respuesta que el modelo vuelve a redactar después. El runner ya conserva ese texto en el contexto siguiente.
- **plai-ui:** `splitAssistantTurnsForAvatar` ya agrupa los mensajes assistant consecutivos, pero los vuelve a dividir en `leading` y `final`. El footer por fragmento con texto produce botones duplicados también durante streaming.
- **Otros hosts del SDK:** el normalizador devolvía un mensaje por fila del historial. Necesitan agrupar turnos además de controlar el footer.
- **Tools datasource:** el componente muestra las pendientes; puede ocultar las completadas sin tarjetas de recursos renderizables. Además, `AssistantMessage` coloca las tools en una fila separada. No es correcto afirmar que todas las datasource tools están ocultas.

## 2. Alcance y orden

| Paso | Repositorio | Trabajo |
|---|---|---|
| P1 | plai-ui | Un footer por turno, al final; borrador intermedio plegable; Copiar solo la respuesta final; finalización explícita por turno. |
| P2 | plai-api | Instrucción de plataforma para las ejecuciones con herramientas, mediante PromptName y overrides de proyecto. Evaluación A8. |
| P3 | ui | S1: agrupar historial. S3: acciones por turno completado y texto final; ejemplo React y documentación coherentes. Changeset minor del cliente. |

Se aplazan **B2 (turn_id), S2 (varios message_start), S4 (tools en línea) y B1.3 (phase/intermediate en SSE)**. No se fusionan las vueltas en BD ni se modifica el contrato SSE. Las optimizaciones U.1–U.6 del roadmap vienen después de fijar este comportamiento.

## 3. Contrato de presentación

Un turno lógico puede tener dos filas visuales, con un único avatar junto a la salida final. Agrupar la presentación no cambia las vueltas que recibe el proveedor.

- `leading`: razonamiento, texto intermedio y herramientas anteriores a la salida final.
- `final`: las partes finales de texto o guardrail. El inicio de un bloque de texto vacío no cuenta como una respuesta final disponible.
- Cuando existe una salida final no vacía o un guardrail, los textos de `leading` se muestran plegados bajo «Borrador previo», siempre recuperables. No se borran ni se considera que sean necesariamente redundantes.
- Si la ejecución falla antes de producir salida final, el contenido parcial sigue accesible sin plegarlo automáticamente.
- Un guardrail terminal nunca permite usar el preámbulo como respuesta final copiable. En esta entrega, las respuestas solo de guardrail no muestran footer.
- El plegado no es una medida de privacidad: los preámbulos y thinking siguen teniendo las limitaciones del guardrail de salida descritas en el roadmap del backend.

### Footer, identidad y Copiar

El footer aparece **una vez, en la última fila visual del turno**, solo cuando hay respuesta final de texto, `persistedMessageId` real y finalización satisfactoria. No se usa un ID temporal como fallback para valorar.

`message_id` puede llegar antes de `message_stop`: recibir el ID no completa el turno. Un error o cancelación no habilita las acciones, aunque ya haya ID. Las acciones de turnos históricos terminados siguen disponibles mientras se genera otro turno.

- **Copiar:** concatena todas las partes de texto de la **respuesta final**, excluyendo borrador, thinking, tools y guardrails.
- **👍/👎:** usa el ID persistido del último assistant del turno, que corresponde a `message_id`.
- **Recargar:** reenvía el mensaje user anterior y **añade otro turno**, conservando el original, como hace hoy `resendMessage`. Sustituir o borrar el turno anterior queda fuera de alcance.

En el SDK, `metadata.completed` es `false` al empezar el stream y `true` al recibir `message_stop` sin error previo. El historial persistido normalizado se considera completado; el API actual no aporta el estado terminal histórico de cada ejecución. Los hosts que hidraten mensajes propios deben aportar explícitamente esa propiedad para habilitar las acciones.

`plai-ui` mantiene un registro de finalización por ID local y persistido mediante los eventos SSE, compatible con las versiones publicadas del SDK. No necesita esperar a publicar P3 para aplicar P1.

## 4. Backend: P2

Añadir `PromptName.TOOL_RESPONSE_INSTRUCTION` (`prompt_utils.tool_response_instruction`) a la configuración central, con el mismo mecanismo de override que `CITATIONS_INSTRUCTION`.

Se aplica cuando hay herramientas realmente disponibles, incluyendo la tool de memorias. La instrucción queda en la parte estable del system prompt, antes de ejemplos dependientes de la consulta y fecha:

> Completa las consultas y acciones necesarias con herramientas antes de redactar la respuesta final. Antes de una tool, limita el texto a un breve preámbulo; no empieces tablas, conclusiones ni fragmentos de respuesta. Tras la última tool, entrega una respuesta final completa y autosuficiente. Si ya habías escrito contenido de respuesta, incorpora toda la información aún pertinente a esa respuesta final. Respeta el formato de salida; si es estructurado, no emitas preámbulos.

No se añade «continúa donde lo dejaste»: esa regla convertiría el borrador plegado en contenido necesario. El prompt es una mitigación probabilística, no una garantía de eliminación de duplicados; no reescribe historiales antiguos.

## 5. SDK: P3

### S1. Normalización de historial

`normalizePlaiThreadMessages` agrupa assistant consecutivos y filas tool legacy intermedias, sin cruzar user ni system. Conserva el orden de las partes y enlaza resultados por `tool_use_id`/`tool_call_id`, sin duplicar el tool_use.

La identidad del grupo y `persistedMessageId` proceden del último **assistant** persistido, nunca de una fila tool legacy. Se admiten `content_blocks` enriquecidos y `content_parts` con resultados embebidos. Las propuestas de memoria mantienen su metadata y estado.

### S3. Helpers y ejemplo

El cliente exporta `groupAssistantMessages`, `getAssistantTurnContent` y `canShowAssistantTurnActions`. El ejemplo React usa el mismo contrato: conserva el borrador en un desplegable, copia solo el texto final y espera a la finalización con ID persistido.

Agrupar por sí solo no elimina el texto duplicado. Los hosts personalizados deben adoptar la política de presentación y acciones para obtener el mismo resultado que el ejemplo.

### Versionado

Changeset **minor** de `@plaisolutions/client`: cambia el número de mensajes del historial y añade metadata/helpers públicos. La publicación del paquete y la actualización de las dependencias de los consumidores son pasos de entrega separados.

## 6. B4: investigación independiente, no bloqueante

351.627 input_tokens es un agregado del turno. Si hubo dos llamadas, ~175.814 sería su media; no demuestra que cada llamada consumiera esa cantidad ni que todo proceda de documentos. Para confirmarlo se necesitan tokens por llamada, tamaño/composición del contexto y separación de cache read/cache creation (roadmap 1E.1).

Distinguir coste del contexto del modelo y bytes de SSE/BD. El adaptador Anthropic envía el `content` del resultado, no toda su metadata. Recortar metadata puede reducir tráfico sin reducir tokens. `resources[].datasource` forma parte del contrato de recursos validado por el SDK; no eliminarlo sin adaptar consumidores y pruebas.

## 7. Criterios de aceptación

| ID | Escenario | Resultado |
|---|---|---|
| A1 | Sin tools | Respuesta final y un footer tras completar y persistir. |
| A2 | Texto → tool → texto, en vivo | Borrador recuperable, respuesta final y un footer al terminar. La posición en línea de la tool queda en S4. |
| A3 | Recarga del historial de A2 | Misma respuesta final, borrador e ID de valoración; un turno lógico. |
| A4 | Varias tools | Orden preservado, copia solo final, un footer. No se exige que el modelo deje de generar cualquier repetición. |
| A5 | Error/cancelación antes o después de message_id | Contenido parcial accesible, sin acciones del turno interrumpido. |
| A6 | Valoración | Usa exactamente message_id / ID del último assistant persistido. |
| A7 | Recargar | Reenvía el user anterior, incluidos adjuntos, y añade otro turno. |
| A8 | Prompt, 10 ejecuciones reales | Comparar antes/después, revisar repetición y completitud de la respuesta final; registrar modelo, pregunta, configuración, resultados y latencia. No confundir tests de fixtures con esta evaluación. |
| A9 | MASK/BLOCK de salida | Guardrail visible; nunca copiar ni valorar el preámbulo como respuesta final. |
| A10 | message_id antes de message_stop | No aparecen acciones prematuramente. |
| A11 | Nuevo turno mientras hay historial | Se conservan las acciones de los turnos anteriores completados. |
| A12 | Inicio de bloque final vacío | El borrador sigue visible hasta que exista contenido final. |

### Validación y pendientes externos

Pruebas automatizadas: agrupación con legacy tools, identidad, asociación de resultados, SSE completo/error, estados de footer, selección de texto final, guardrails y prompt de plataforma. Ejecutar las suites de cliente/React y los checks de tipos de los hosts, además de las pruebas relevantes del backend.

A8 requiere URL de entorno, agente de Due Diligence, pregunta exacta y acceso configurado. No se considera completado sin invocaciones reales y revisión del contenido. B4 necesita datos reales por llamada. Publicación y despliegue no forman parte de la validación local.

### Resultado de la validación local

- Backend: 23 tests de prompt y orquestador pasan.
- SDK: 80 tests del cliente y 109 de React pasan; tipos y lint de ambos paquetes correctos. Compilación del cliente correcta.
- plai-ui: 16 tests pasan; tipos y lint de los archivos modificados correctos.
- Ejemplo react-chat: comprobación de tipos correcta.
- Se cubren cancelación con ID persistido, error de transporte, guardrail terminal, historial agrupado y propuestas de memoria con actualización de estado.
- No se ha hecho una prueba visual en navegador ni A8 contra un servidor real. Sin mediciones B4 por llamada.
