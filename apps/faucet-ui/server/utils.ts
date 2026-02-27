import type { H3Event } from "h3"
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

export const getTrustedClientIp = (event: H3Event) =>
	getHeader(event, "cf-connecting-ip")?.trim() || null
