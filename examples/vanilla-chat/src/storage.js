const CONFIG_KEY = "plai-demo-config";
const SESSION_KEY = "plai-demo-session";

export function loadConfig() {
	try {
		const raw = localStorage.getItem(CONFIG_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function saveConfig(config) {
	localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function loadSession() {
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function saveSession(session) {
	localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
	localStorage.removeItem(SESSION_KEY);
}
