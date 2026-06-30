export const DEFAULT_API = "https://api.plaisolutions.com";

async function parseError(response) {
	const body = await response.text();
	try {
		const json = JSON.parse(body);
		return json.detail ?? json.error ?? body;
	} catch {
		return body || response.statusText;
	}
}

export async function createChatSession({
	api,
	projectToken,
	agentId,
	externalRef,
}) {
	const base = api.replace(/\/$/, "");
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
	});

	if (!response.ok) {
		throw new Error(await parseError(response));
	}

	return response.json();
}

export async function createThread({ api, chatSessionId, chatToken }) {
	const base = api.replace(/\/$/, "");
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
	);

	if (!response.ok) {
		throw new Error(await parseError(response));
	}

	return response.json();
}
