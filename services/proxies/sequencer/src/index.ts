const sequencer = "https://testnet.zeko.io"

async function getSpamState({ ip, env }: { ip: string; env: Env }) {
	const spamKey = `spam:${ip}`
	const spamCountStr = await env.SEQUENCER_IP_SPAM.get(spamKey)
	const spamCount = spamCountStr ? Number.parseInt(spamCountStr, 10) || 0 : 0
	const spam = spamCount + 1
	const spamWindow = Number.parseInt(env.SPAM_WINDOW_SECONDS, 10)
	await env.SEQUENCER_IP_SPAM.put(spamKey, spam.toString(), { expirationTtl: spamWindow })
	const spamThreshold = Number.parseInt(env.SPAM_THRESHOLD, 10)
	return { spam, spamThreshold, spamWindow }
}

export default {
	async fetch(request, env) {
		const ip =
			request.headers.get("cf-connecting-ip") ||
			request.headers.get("x-forwarded-for") ||
			request.headers.get("x-real-ip") ||
			"unknown"
		const newRequest = new Request(sequencer, request)

		let priority = 1

		// Sequencer rate limiting
		const { success } = await env.SEQUENCER_RATE_LIMIT.limit({ key: ip })
		if (success) {
			priority = priority + 2
		}

		// IP Shadow Ban
		const banned = await env.SEQUENCER_SHADOW_BANNED_IPS.get(ip)
		if (banned) {
			priority = priority + 3
		}

		// IP Spam shadow ban
		const { spam, spamThreshold } = await getSpamState({ ip, env })
		if (spam > spamThreshold) {
			const banTtl = Number.parseInt(env.BAN_TTL_SECONDS ?? String(60 * 60 * 24), 10) //24 hours
			await env.SEQUENCER_SHADOW_BANNED_IPS.put(ip, new Date().toISOString(), {
				expirationTtl: banTtl
			})
			priority = priority + 3
		}

		const extraHeaders = { "zeko-priority": priority.toString() }
		const mergedHeaders = new Headers(newRequest.headers)
		for (const [key, value] of Object.entries(extraHeaders)) {
			mergedHeaders.set(key, value)
		}
		const response = await fetch(newRequest, { headers: mergedHeaders })
		return response
	}
} satisfies ExportedHandler<Env>
