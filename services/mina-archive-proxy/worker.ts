const backends = [
	{
		name: "zeko-mina-archive-devnet",
		url: "https://zeko-mina-archive.staketab.com"
	},
	{
		name: "minascan-mina-archive-devnet",
		url: "https://api.minascan.io/archive/devnet/v1/graphql"
	}
]

// The name of the cookie used for sticky sessions
const COOKIE_NAME = "mina-archive-devnet"

export default {
	async fetch(request) {
		const cookie = request.headers.get("Cookie") || ""
		const stickyBackendName = getCookieValue(cookie, COOKIE_NAME)

		const orderedBackends = getOrderedBackends(stickyBackendName)

		for (const backend of orderedBackends) {
			try {
				console.log(`Trying backend: ${backend.name}`)

				const response = await fetch(backend.url, request)

				if (response.ok) {
					console.log(`Success with backend: ${backend.name}`)

					const newResponse = new Response(response.body, response)

					newResponse.headers.set(
						"Set-Cookie",
						`${COOKIE_NAME}=${backend.name}; Path=/; HttpOnly; Secure; SameSite=Lax`
					)

					return newResponse
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				console.error(`Backend ${backend.name} failed:`, message)
			}
		}

		return new Response("All GraphQL backends are currently unavailable.", {
			status: 503,
			statusText: "Service Unavailable"
		})
	}
} satisfies ExportedHandler

/**
 * Helper function to parse a cookie string and get a specific value
 */
function getCookieValue(cookieString: string, key: string) {
	const cookies = cookieString.split(";")
	for (const cookie of cookies) {
		const parts = cookie.split("=")
		const name = parts.shift()?.trim()
		if (name === key) {
			return parts.join("=").trim()
		}
	}
	return null
}

/**
 * Creates a prioritized list of backends, putting the sticky one first.
 */
function getOrderedBackends(stickyBackendName: string | null) {
	const preferredBackend = backends.find((b) => b.name === stickyBackendName)

	if (preferredBackend) {
		// If the sticky backend is found, put it at the front of the array to try first.
		return [preferredBackend, ...backends.filter((b) => b.name !== stickyBackendName)]
	}

	// Otherwise, return the default order (or you could randomize it)
	return backends
}
