import { PlaiChat, PlaiThreadTransport } from "@plaisolutions/client"

export function createPlaiChat({ api, chatSessionId, threadId, chatToken }) {
  return new PlaiChat({
    transport: new PlaiThreadTransport({
      api,
      chatSessionId,
      threadId,
      headers: { Authorization: `Bearer ${chatToken}` },
    }),
  })
}

function getMessageText(message) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
}

export function renderMessages(container, messages) {
  container.replaceChildren()

  if (messages.length === 0) {
    const empty = document.createElement("p")
    empty.className = "messages-empty"
    empty.textContent = "No messages yet. Send the first one."
    container.append(empty)
    return
  }

  for (const message of messages) {
    const bubble = document.createElement("article")
    bubble.className = `message message--${message.role}`

    const role = document.createElement("span")
    role.className = "message-role"
    role.textContent = message.role

    const text = document.createElement("p")
    text.className = "message-text"
    text.textContent = getMessageText(message) || "(no text)"

    bubble.append(role, text)

    const toolParts = message.parts.filter((part) => part.type === "tool-call")
    if (toolParts.length > 0) {
      const tools = document.createElement("details")
      tools.className = "message-tools"
      const summary = document.createElement("summary")
      summary.textContent = `${toolParts.length} tool call(s)`
      const pre = document.createElement("pre")
      pre.textContent = JSON.stringify(toolParts, null, 2)
      tools.append(summary, pre)
      bubble.append(tools)
    }

    container.append(bubble)
  }

  container.scrollTop = container.scrollHeight
}

export function renderRawState(container, state) {
  container.textContent = JSON.stringify(state, null, 2)
}
