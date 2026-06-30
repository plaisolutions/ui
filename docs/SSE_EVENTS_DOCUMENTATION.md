# Server-Sent Events (SSE) Documentation for `invoke_thread_from_chat_session` Endpoint

## Overview

The `invoke_thread_from_chat_session` endpoint streams responses using Server-Sent Events (SSE). This document provides a complete reference of all events and their payloads that can be emitted during a streaming response.

**Endpoint:** `POST /chat_sessions/{chat_session_id}/threads/{thread_id}/invoke`  
**Content-Type:** `text/event-stream`

---

## Event Types

### 1. `message_start`

Emitted at the very beginning of the streaming response, before any content blocks.

**Event Name:** `message_start`

**Payload:**

```json
{
  "type": "message_start",
  "message": {
    "id": "msg_<uuid>",
    "role": "assistant",
    "model": "gpt-4o" | "claude-3-5-sonnet-20241022" | "gemini-2.0-flash"
  }
}
```

**Fields:**

- `type`: Always `"message_start"`
- `message.id`: Unique message identifier (format: `msg_` followed by UUID)
- `message.role`: Always `"assistant"`
- `message.model`: The LLM model codename being used (e.g., `"gpt-4o"`, `"claude-3-5-sonnet-20241022"`)

**When Emitted:** Once at the start of every streaming response.

---

### 2. `content_block_start`

Emitted when a new content block begins. Content blocks can be `text`, `tool_use`, or `guardrail`.

**Event Name:** `content_block_start`

**Payload for Text Block:**

```json
{
  "type": "content_block_start",
  "index": 0,
  "content_block": {
    "type": "text"
  }
}
```

**Payload for Tool Use Block:**

```json
{
  "type": "content_block_start",
  "index": 1,
  "content_block": {
    "type": "tool_use",
    "id": "toolu_123",
    "name": "knowledge_search",
    "tool_type": "vector_search",
    "input": {
      "query": "example query"
    },
    "input_schema": {
      "type": "object",
      "properties": {
        "query": { "type": "string" }
      }
    }
  }
}
```

**Payload for Guardrail Block:**

```json
{
  "type": "content_block_start",
  "index": 0,
  "content_block": {
    "type": "guardrail",
    "content": "This content was filtered by guardrails."
  }
}
```

**Fields:**

- `type`: Always `"content_block_start"`
- `index`: Sequential index of the content block (0-based, increments for each new block)
- `content_block.type`: One of `"text"`, `"tool_use"`, or `"guardrail"`
- `content_block.id`: Tool call ID (only present for `tool_use` blocks)
- `content_block.name`: Tool name (only present for `tool_use` blocks)
- `content_block.tool_type`: Internal tool type identifier from the agent's tool registry (only present for `tool_use` blocks; may be `null` if not registered)
- `content_block.input`: Tool arguments as JSON object (only present for `tool_use` blocks)
- `content_block.input_schema`: JSON Schema describing the tool's input (only present for `tool_use` blocks; empty object `{}` if not available)
- `content_block.content`: The guardrail-modified text (only present for `guardrail` blocks)

**When Emitted:**

- Before streaming text content (`text` block)
- When the LLM decides to call a tool (`tool_use` block)
- When an input or output guardrail fires (`guardrail` block)

**Note:** Each `content_block_start` must be followed by a corresponding `content_block_stop` before the next block starts. Guardrail blocks have no `content_block_delta` events between them.

---

### 3. `content_block_delta`

Emitted for each chunk of text content within a text content block. Text is streamed character-by-character or in small chunks.

**Event Name:** `content_block_delta`

**Payload:**

```json
{
  "type": "content_block_delta",
  "index": 0,
  "delta": {
    "type": "text_delta",
    "text": "Hello"
  }
}
```

**Fields:**

- `type`: Always `"content_block_delta"`
- `index`: The index of the content block this delta belongs to (matches the `index` from `content_block_start`)
- `delta.type`: Always `"text_delta"` for text content
- `delta.text`: The text chunk being streamed (can be a single character, word, or larger chunk)

**When Emitted:** Multiple times during text streaming, between `content_block_start` and `content_block_stop` for text blocks. Not emitted for `tool_use` or `guardrail` blocks.

**Note:** Newlines (`\n`) are emitted as separate delta events to avoid escaping issues.

---

### 4. `content_block_stop`

Emitted when a content block finishes.

**Event Name:** `content_block_stop`

**Payload:**

```json
{
  "type": "content_block_stop",
  "index": 0
}
```

**Fields:**

- `type`: Always `"content_block_stop"`
- `index`: The index of the content block that is finishing (matches the `index` from `content_block_start`)

**When Emitted:** After all deltas for a content block have been sent, before the next `content_block_start` (if any).

**Note:** Every `content_block_start` must have a corresponding `content_block_stop`.

---

### 5. `tool_result`

Emitted when a tool execution completes. This event is only emitted if `show_tool_calls` is enabled.

**Event Name:** `tool_result`

**Payload (Success):**

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_123",
  "tool_type": "vector_search",
  "content": "Tool execution result...",
  "is_error": false,
  "error_details": null,
  "metadata": {}
}
```

**Payload (Error):**

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_123",
  "tool_type": "vector_search",
  "content": "Error message or empty string",
  "is_error": true,
  "error_details": "Detailed error description",
  "metadata": {
    "error_details": "Detailed error description"
  }
}
```

**Fields:**

- `type`: Always `"tool_result"`
- `tool_use_id`: The ID of the tool call that was executed (matches `content_block_start.content_block.id` from the corresponding `tool_use` block)
- `tool_type`: Internal tool type identifier; resolved from the tool registry first, falling back to `metadata.type` if not found (may be `null`)
- `content`: The result content from the tool execution, or error message if `is_error` is true
- `is_error`: Boolean indicating whether the tool execution resulted in an error
- `error_details`: Human-readable error details string when `is_error` is `true` and the metadata contains an `error_details` key; otherwise `null`
- `metadata`: The raw metadata object returned by the tool execution (may be an empty object `{}`)

**When Emitted:** After a tool has been executed, following the corresponding `content_block_stop` for the `tool_use` block.

**Note:** This event is only emitted when `show_tool_calls` is `true` in the agent configuration.

---

### 6. `message_id`

Emitted after the message has been stored in the database (only if `thread_id` is provided).

**Event Name:** `message_id`

**Payload:**

```json
{
  "type": "message_id",
  "message_id": "msg_db_123"
}
```

**Fields:**

- `type`: Always `"message_id"`
- `message_id`: The database ID of the stored message

**When Emitted:** After all content blocks have been streamed and the message has been persisted to the database, but before `usage` and `message_stop`.

**Note:** This event is only emitted when `thread_id` is not `None`.

---

### 7. `usage`

Emitted to provide token usage information for the entire request.

**Event Name:** `usage`

**Payload:**

```json
{
  "type": "usage",
  "input_tokens": 150,
  "output_tokens": 45,
  "cached_tokens": 20
}
```

**Payload (No Cached Tokens):**

```json
{
  "type": "usage",
  "input_tokens": 150,
  "output_tokens": 45,
  "cached_tokens": null
}
```

**Fields:**

- `type`: Always `"usage"`
- `input_tokens`: Total prompt tokens used (cumulative across all LLM calls)
- `output_tokens`: Total completion tokens used (cumulative across all LLM calls)
- `cached_tokens`: Total cached tokens (may be `null` if not supported by provider or no caching occurred)

**When Emitted:** Near the end of the stream, after all content blocks and `message_id` (if applicable), but before `message_stop`.

**Note:** Token counts are cumulative across all agent steps (if tools are used, multiple LLM calls may occur).

---

### 8. `message_stop`

Emitted at the very end of the streaming response, indicating the stream is complete.

**Event Name:** `message_stop`

**Payload:**

```json
{
  "type": "message_stop"
}
```

**Fields:**

- `type`: Always `"message_stop"`

**When Emitted:** Once at the end of every streaming response — both on success (after `usage`) and on error (after the `error` event).

---

### 9. `error`

Emitted when an error occurs during streaming.

**Event Name:** `error`

**Payload (Context Length Exceeded):**

```json
{
  "type": "error",
  "error": {
    "type": "context_length_exceeded",
    "message": "Model context length exceeded."
  }
}
```

**Payload (LLM Error):**

```json
{
  "type": "error",
  "error": {
    "type": "llm_error",
    "message": "Error message from LLM provider"
  }
}
```

**Payload (HTTP Error):**

```json
{
  "type": "error",
  "error": {
    "type": "http_error",
    "message": "HTTP error detail"
  }
}
```

**Payload (Internal Error):**

```json
{
  "type": "error",
  "error": {
    "type": "internal_error",
    "message": "Something occurred and we couldn't generate a response."
  }
}
```

**Fields:**

- `type`: Always `"error"`
- `error.type`: One of:
  - `"context_length_exceeded"`: The model's context window was exceeded
  - `"llm_error"`: An error occurred from the LLM provider
  - `"http_error"`: An HTTP-level error was raised during invocation (e.g., auth failure, upstream timeout)
  - `"internal_error"`: An unexpected internal server error occurred
- `error.message`: Human-readable error message

**When Emitted:** When an exception occurs during streaming. A `message_stop` event always follows the `error` event on this endpoint.

---

## Event Flow Examples

### Example 1: Simple Text Response

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_abc123","role":"assistant","model":"gpt-4o"}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_id
data: {"type":"message_id","message_id":"msg_db_456"}

event: usage
data: {"type":"usage","input_tokens":10,"output_tokens":2,"cached_tokens":null}

event: message_stop
data: {"type":"message_stop"}
```

> **Note:** The exact order of events within a response depends on the LLM provider. Treat each event independently and do not assume a fixed sequence between content blocks, tool calls, and metadata events.

### Example 2: Response with Tool Use

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_def456","role":"assistant","model":"claude-3-5-sonnet-20241022"}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Let me search for that."}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_789","name":"knowledge_search","tool_type":"vector_search","input":{"query":"example"},"input_schema":{"type":"object","properties":{"query":{"type":"string"}}}}}

event: content_block_stop
data: {"type":"content_block_stop","index":1}

event: tool_result
data: {"type":"tool_result","tool_use_id":"toolu_789","tool_type":"vector_search","content":"Search results...","is_error":false,"error_details":null,"metadata":{}}

event: content_block_start
data: {"type":"content_block_start","index":2,"content_block":{"type":"text"}}

event: content_block_delta
data: {"type":"content_block_delta","index":2,"delta":{"type":"text_delta","text":"Based on the search results"}}

event: content_block_stop
data: {"type":"content_block_stop","index":2}

event: message_id
data: {"type":"message_id","message_id":"msg_db_789"}

event: usage
data: {"type":"usage","input_tokens":150,"output_tokens":45,"cached_tokens":20}

event: message_stop
data: {"type":"message_stop"}
```

### Example 3: Input Guardrail Triggered

When an input guardrail blocks the request, the content is delivered as a `guardrail` content block (not as a regular `text` block), and the stream ends immediately after `usage` and `message_stop`.

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_ghi789","role":"assistant","model":"gpt-4o"}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"guardrail","content":"This content was filtered by guardrails."}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: usage
data: {"type":"usage","input_tokens":0,"output_tokens":0,"cached_tokens":null}

event: message_stop
data: {"type":"message_stop"}
```

### Example 4: Output Guardrail Triggered

When an output guardrail modifies the final response, a `guardrail` block is appended after all normal content blocks have finished.

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_out123","role":"assistant","model":"gpt-4o"}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Original response text."}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"guardrail","content":"Guardrail-modified response text."}}

event: content_block_stop
data: {"type":"content_block_stop","index":1}

event: message_id
data: {"type":"message_id","message_id":"msg_db_out456"}

event: usage
data: {"type":"usage","input_tokens":100,"output_tokens":20,"cached_tokens":null}

event: message_stop
data: {"type":"message_stop"}
```

### Example 5: Error During Streaming

An `error` event is always followed by `message_stop` on this endpoint.

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_jkl012","role":"assistant","model":"gpt-4o"}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Some text"}}

event: error
data: {"type":"error","error":{"type":"context_length_exceeded","message":"Model context length exceeded."}}

event: message_stop
data: {"type":"message_stop"}
```

---

## Event Ordering Rules

1. **`message_start`** is always the first event
2. **`content_block_start`** must be followed by zero or more **`content_block_delta`** events, then **`content_block_stop`**
3. **`tool_use`** and **`guardrail`** content blocks never have `content_block_delta` events between their `content_block_start` and `content_block_stop`
4. **`tool_result`** events follow the **`content_block_stop`** of the corresponding `tool_use` block
5. **Output guardrail** blocks (if any) appear after all normal content blocks are closed
6. **`message_id`** is emitted after all content blocks (only if `thread_id` is provided)
7. **`usage`** is emitted after `message_id` (or after content blocks if no `message_id`)
8. **`message_stop`** is always the last event — both on success and on error
9. **`error`** events are always followed by `message_stop`; no other events follow the error

---

## Client Implementation Guidelines

### Parsing SSE Events

SSE events follow the standard format:

```
event: <event_name>
data: <json_or_text>
\n\n
```

### Handling Events

1. **Initialize state** when receiving `message_start`
2. **Accumulate text** from `content_block_delta` events (track by `index`)
3. **Handle tool calls** when receiving `tool_use` blocks and corresponding `tool_result` events
4. **Handle guardrails** when receiving `guardrail` blocks — use `content_block.content` as the display text
5. **Update UI** incrementally as events arrive
6. **Finalize** when receiving `message_stop`

### Error Handling

- Always check for `error` events
- Handle partial content if an error occurs mid-stream
- Display appropriate error messages based on `error.type`
- `message_stop` always follows an `error` on this endpoint — use it as the reliable stream-end signal

### Content Block Tracking

- Track content blocks by their `index` field
- Each `content_block_start` with a given `index` must be followed by `content_block_stop` with the same `index`
- Accumulate `content_block_delta` events for the same `index` to reconstruct the full text
- `tool_use` and `guardrail` blocks carry all their data in `content_block_start`; no deltas will arrive for them

### Tool Result Matching

- Match `tool_result.tool_use_id` with `content_block_start.content_block.id` from the corresponding `tool_use` block
- Use `is_error` to determine if tool execution succeeded
- `error_details` provides additional context when `is_error` is `true`

---

## Notes for LLM Integration

When integrating this endpoint with an LLM or building a client:

1. **Stream Processing**: Process events sequentially as they arrive; don't wait for the complete stream
2. **State Management**: Maintain state for:
   - Current message ID
   - Active content blocks (by index)
   - Accumulated text per content block
   - Tool calls and their results
3. **Error Recovery**: Handle partial responses gracefully if errors occur; `message_stop` always follows
4. **Token Tracking**: Use `usage` events for cost tracking and rate limiting
5. **Guardrails**: Guardrails are delivered as `content_block_start` events with `content_block.type = "guardrail"` — not as a separate event type. Use `content_block.content` as the replacement text
6. **Tool Calls**: Tool results may arrive asynchronously; match them to tool calls by ID

---

## Provider-Specific Notes

- **OpenAI**: Supports cached tokens (`cached_tokens` may be non-null)
- **Anthropic**: Supports cached tokens (`cached_tokens` may be non-null)
- **Google**: Does not support cached tokens (`cached_tokens` will always be `null`)

All providers support the same event structure, ensuring a consistent client implementation.
