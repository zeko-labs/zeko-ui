import { type } from "arktype"

export const validateBody = type({ address: "string.alphanumeric", cfToken: "string" })

export async function verifyTurnstile({
	token,
	ip,
	secret
}: { token: string; secret: string; ip: string }): Promise<boolean> {
	try {
		const verifyEndpoint = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

		const response = await fetch(verifyEndpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ secret, response: token, remoteip: ip })
		})

		const data = (await response.json()) as { success: boolean }
		if (data.success) return true
		console.error("Turnstile verification response:", data)
		return false
	} catch (error) {
		console.error("Error verifying Turnstile token:", error)
		return false
	}
}

export async function getSpamState({ ip, env }: { ip: string; env: Env }) {
	const spamKey = `spam:${ip}`
	const spamCountStr = await env.FAUCET_IP_SPAM.get(spamKey)
	const spamCount = spamCountStr ? Number.parseInt(spamCountStr, 10) || 0 : 0
	const spam = spamCount + 1
	const spamWindow = Number.parseInt(env.SPAM_WINDOW_SECONDS, 10)
	await env.FAUCET_IP_SPAM.put(spamKey, spam.toString(), { expirationTtl: spamWindow })
	const spamThreshold = Number.parseInt(env.SPAM_THRESHOLD, 10)
	return { spam, spamThreshold, spamWindow }
}
