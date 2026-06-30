import { useState } from "react"
import { DEFAULT_API } from "../api"
import type { DemoConfig } from "../storage"

type SetupPanelProps = {
  initialConfig: DemoConfig | null
  onCreateSession: (config: DemoConfig) => Promise<void>
  onClearSession: () => void
}

export function SetupPanel({
  initialConfig,
  onCreateSession,
  onClearSession,
}: SetupPanelProps) {
  const [api, setApi] = useState(initialConfig?.api ?? DEFAULT_API)
  const [projectToken, setProjectToken] = useState(
    initialConfig?.projectToken ?? "",
  )
  const [agentId, setAgentId] = useState(initialConfig?.agentId ?? "")
  const [externalRef, setExternalRef] = useState(
    initialConfig?.externalRef ?? "",
  )
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  function validate(): string | null {
    if (!projectToken.trim()) return "Project token is required."
    if (!agentId.trim()) return "Agent ID is required."
    if (!externalRef.trim()) return "External ref is required."
    return null
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    const config: DemoConfig = {
      api: api.trim() || DEFAULT_API,
      projectToken: projectToken.trim(),
      agentId: agentId.trim(),
      externalRef: externalRef.trim(),
    }

    setIsCreating(true)

    try {
      await onCreateSession(config)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session.")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <section className="panel setup-panel">
      <h2>1. Setup</h2>
      <form className="setup-form" onSubmit={handleSubmit}>
        <label>
          API URL
          <input
            type="url"
            value={api}
            onChange={(event) => setApi(event.target.value)}
            autoComplete="off"
          />
        </label>
        <label>
          Project token
          <input
            type="password"
            value={projectToken}
            onChange={(event) => setProjectToken(event.target.value)}
            placeholder="Project bearer token"
            autoComplete="off"
          />
          <small>
            <b>Never expose this token to the client.</b> This is for demo
            purposes only.
          </small>
        </label>
        <label>
          Agent ID
          <input
            type="text"
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
            placeholder="agent_..."
            autoComplete="off"
          />
        </label>
        <label>
          External ref
          <input
            type="text"
            value={externalRef}
            onChange={(event) => setExternalRef(event.target.value)}
            placeholder="user-123"
            autoComplete="off"
          />
        </label>
        <div className="setup-actions">
          <button type="submit" disabled={isCreating}>
            {isCreating ? "Creating…" : "Create session"}
          </button>
          <button type="button" className="secondary" onClick={onClearSession}>
            Clear saved session
          </button>
        </div>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  )
}
