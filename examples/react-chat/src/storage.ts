import type { ChatSession } from "./api"

const CONFIG_KEY = "plai-react-demo-config"
const SESSION_KEY = "plai-react-demo-session"

export type DemoConfig = {
  api: string
  projectToken: string
  agentId: string
  externalRef: string
}

export function loadConfig(): DemoConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    return raw ? (JSON.parse(raw) as DemoConfig) : null
  } catch {
    return null
  }
}

export function saveConfig(config: DemoConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

export function loadSession(): ChatSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as ChatSession) : null
  } catch {
    return null
  }
}

export function saveSession(session: ChatSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
