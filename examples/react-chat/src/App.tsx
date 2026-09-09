import { useState } from "react"
import {
  type ChatSession,
  createChatSession,
  getChatSessionDetails,
} from "./api"
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

    let nextSession = await createChatSession(nextConfig)
    try {
      const details = await getChatSessionDetails({
        api: nextConfig.api,
        chatSessionId: nextSession.id,
        chatToken: nextSession.chat_token,
      })
      nextSession = { ...nextSession, agent: details.agent }
    } catch {
      // Agent metadata is presentational; the chat can still run without it.
    }
    saveSession(nextSession)
    setSession(nextSession)
  }

  function handleClearSession() {
    clearSession()
    setSession(null)
  }

  if (session && config) {
    return (
      <ChatPanel
        key={`${session.id}-${session.thread_id}`}
        session={session}
        config={config}
        onDisconnect={handleClearSession}
      />
    )
  }

  return (
    <main className="setup-page">
      <SetupPanel
        initialConfig={config}
        onCreateSession={handleCreateSession}
        onClearSession={handleClearSession}
      />
    </main>
  )
}
