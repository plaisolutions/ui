import "./style.css"
import { createChatSession, createThread, DEFAULT_API } from "./api.js"
import { createPlaiChat, renderMessages, renderRawState } from "./chat.js"
import {
  clearSession,
  loadConfig,
  loadSession,
  saveConfig,
  saveSession,
} from "./storage.js"

const $ = (selector) => document.querySelector(selector)

const setupForm = $("#setup-form")
const chatPanel = $("#chat-panel")
const sessionInfo = $("#session-info")
const statusEl = $("#status")
const messagesEl = $("#messages")
const rawStateEl = $("#raw-state")
const chatForm = $("#chat-form")
const messageInput = $("#input")
const sendButton = $("#send-button")
const stopButton = $("#stop-button")
const setupError = $("#setup-error")
const chatError = $("#chat-error")

let chat = null
let unsubscribe = null

function setSetupError(message) {
  setupError.textContent = message ?? ""
  setupError.hidden = !message
}

function setChatError(message) {
  chatError.textContent = message ?? ""
  chatError.hidden = !message
}

function setStatus(status) {
  statusEl.textContent = status
  statusEl.dataset.status = status
}

function updateSessionInfo(session) {
  sessionInfo.innerHTML = `
		<dl class="session-dl">
			<div><dt>Session ID</dt><dd><code>${session.id}</code></dd></div>
			<div><dt>Thread ID</dt><dd><code>${session.thread_id}</code></dd></div>
			<div><dt>Agent ID</dt><dd><code>${session.agent_id}</code></dd></div>
		</dl>
	`
}

function getSetupValues() {
  return {
    api: $("#api-url").value.trim() || DEFAULT_API,
    projectToken: $("#project-token").value.trim(),
    agentId: $("#agent-id").value.trim(),
    externalRef: $("#external-ref").value.trim(),
  }
}

function validateSetup(values) {
  if (!values.projectToken) return "Project token is required."
  if (!values.agentId) return "Agent ID is required."
  if (!values.externalRef) return "External ref is required."
  return null
}

function destroyChat() {
  unsubscribe?.()
  unsubscribe = null
  chat = null
}

function initChat(session, config) {
  destroyChat()

  chat = createPlaiChat({
    api: config.api,
    chatSessionId: session.id,
    threadId: session.thread_id,
    chatToken: session.chat_token,
  })

  unsubscribe = chat.subscribe((state) => {
    setStatus(state.status)
    renderMessages(messagesEl, state.messages)
    renderRawState(rawStateEl, state)

    const isBusy = state.status === "submitted" || state.status === "streaming"
    messageInput.disabled = isBusy
    sendButton.disabled = isBusy
    stopButton.disabled = !isBusy

    if (state.error) {
      setChatError(`${state.error.type}: ${state.error.message}`)
    } else {
      setChatError(null)
    }
  })

  chatPanel.hidden = false
  updateSessionInfo(session)
  setSetupError(null)
  setChatError(null)
}

async function handleCreateSession(event) {
  event.preventDefault()
  setSetupError(null)

  const values = getSetupValues()
  const validationError = validateSetup(values)
  if (validationError) {
    setSetupError(validationError)
    return
  }

  saveConfig(values)

  const button = $("#create-session")
  button.disabled = true
  button.textContent = "Creating…"

  try {
    const session = await createChatSession(values)
    saveSession(session)
    initChat(session, values)
  } catch (error) {
    setSetupError(
      error instanceof Error ? error.message : "Failed to create session.",
    )
  } finally {
    button.disabled = false
    button.textContent = "Create session"
  }
}

async function handleNewThread() {
  if (!chat) return

  const session = loadSession()
  const config = loadConfig()
  if (!session || !config) return

  setChatError(null)
  const button = $("#new-thread")
  button.disabled = true

  try {
    const thread = await createThread({
      api: config.api,
      chatSessionId: session.id,
      chatToken: session.chat_token,
    })

    const updatedSession = { ...session, thread_id: thread.id }
    saveSession(updatedSession)
    initChat(updatedSession, config)
  } catch (error) {
    setChatError(
      error instanceof Error ? error.message : "Failed to create thread.",
    )
  } finally {
    button.disabled = false
  }
}

function handleClearSession() {
  destroyChat()
  clearSession()
  chatPanel.hidden = true
  setSetupError(null)
  setChatError(null)
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault()
  if (!chat) return

  const text = messageInput.value.trim()
  if (!text) return

  messageInput.value = ""

  try {
    await chat.sendMessage({ text })
  } catch (error) {
    setChatError(
      error instanceof Error ? error.message : "Failed to send message.",
    )
  }
})

stopButton.addEventListener("click", () => {
  chat?.stop()
})

$("#new-thread").addEventListener("click", handleNewThread)
$("#clear-session").addEventListener("click", handleClearSession)
setupForm.addEventListener("submit", handleCreateSession)

function bootstrap() {
  const config = loadConfig()
  if (config) {
    $("#api-url").value = config.api ?? DEFAULT_API
    $("#project-token").value = config.projectToken ?? ""
    $("#agent-id").value = config.agentId ?? ""
    $("#external-ref").value = config.externalRef ?? ""
  }

  const session = loadSession()
  if (session && config) {
    initChat(session, config)
  } else {
    chatPanel.hidden = true
    setStatus("idle")
  }
}

bootstrap()
