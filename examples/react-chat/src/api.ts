export const DEFAULT_API = "https://api.plaisolutions.com"

export type ChatSession = {
  id: string
  thread_id: string
  agent_id: string
  chat_token: string
}

export type Thread = {
  id: string
}

async function parseError(response: Response): Promise<string> {
  const body = await response.text()
  try {
    const json = JSON.parse(body) as { detail?: string; error?: string }
    return json.detail ?? json.error ?? body
  } catch {
    return body || response.statusText
  }
}

export async function createChatSession({
  api,
  projectToken,
  agentId,
  externalRef,
}: {
  api: string
  projectToken: string
  agentId: string
  externalRef: string
}): Promise<ChatSession> {
  const base = api.replace(/\/$/, "")
  const response = await fetch(`${base}/chat_sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${projectToken}`,
    },
    body: JSON.stringify({
      agent_id: agentId,
      external_ref: externalRef,
    }),
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json() as Promise<ChatSession>
}

export async function createThread({
  api,
  chatSessionId,
  chatToken,
}: {
  api: string
  chatSessionId: string
  chatToken: string
}): Promise<Thread> {
  const base = api.replace(/\/$/, "")
  const response = await fetch(
    `${base}/chat_sessions/${encodeURIComponent(chatSessionId)}/threads`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chatToken}`,
      },
      body: JSON.stringify({}),
    },
  )

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return response.json() as Promise<Thread>
}
