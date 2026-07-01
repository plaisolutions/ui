import { useState } from "react"
import { type ChatSession, createChatSession, createThread } from "./api"
import { ChatPanel } from "./components/ChatPanel"
import { SetupPanel } from "./components/SetupPanel"
import {
  type DemoConfig,
  clearSession,
  loadConfig,
  loadSession,
  saveConfig,
  saveSession,
} from "./storage"

export function App() {
  const [config, setConfig] = useState<DemoConfig | null>(() => loadConfig())
  const [session, setSession] = useState<ChatSession | null>(() =>
    loadSession(),
  )

  async function handleCreateSession(nextConfig: DemoConfig) {
    saveConfig(nextConfig)
    setConfig(nextConfig)

    const nextSession = await createChatSession(nextConfig)
    saveSession(nextSession)
    setSession(nextSession)
  }

  async function handleNewThread() {
    if (!session || !config) return

    const thread = await createThread({
      api: config.api,
      chatSessionId: session.id,
      chatToken: session.chat_token,
    })

    const updatedSession = { ...session, thread_id: thread.id }
    saveSession(updatedSession)
    setSession(updatedSession)
  }

  function handleClearSession() {
    clearSession()
    setSession(null)
  }

  return (
    <div id="app">
      <header className="header">
        <h1>@plaisolutions/react demo</h1>
        <p className="subtitle">
          Create a chat session, save it to localStorage, and interact with{" "}
          <code>useChat</code>.
        </p>
      </header>

      <SetupPanel
        initialConfig={config}
        onCreateSession={handleCreateSession}
        onClearSession={handleClearSession}
      />

      {session && config && (
        <ChatPanel
          key={`${session.id}-${session.thread_id}`}
          session={session}
          config={config}
          onNewThread={handleNewThread}
        />
      )}
    </div>
  )
}
