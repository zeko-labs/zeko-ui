const hostnames = [
	"https://zeko-mina-archive.staketab.com",
	"https://api.minascan.io/archive/devnet/v1/graphql"
]

function getRandomInt(max: number): number {
	return Math.floor(Math.random() * max)
}

export default {
	async fetch(request: Request): Promise<Response> {
		try {
			// Preserve original URL
			const sourceUrl = new URL(request.url)

			// Pick primary and backup
			const primaryIndex = getRandomInt(hostnames.length)
			let backupIndex = primaryIndex
			if (hostnames.length > 1) {
				do {
					backupIndex = getRandomInt(hostnames.length)
				} while (backupIndex === primaryIndex)
			}
			// Combine backend base URL + original path + query
			const makeTargetUrl = (base: string) => {
				const baseUrl = new URL(base)
				// join the backend base path + the incoming path
				const joinedPath =
					baseUrl.pathname.replace(/\/$/, "") + "/" + sourceUrl.pathname.replace(/^\//, "")
				baseUrl.pathname = joinedPath
				baseUrl.search = sourceUrl.search // preserve query string
				return baseUrl
			}

			const primaryUrl = makeTargetUrl(hostnames[primaryIndex])
			const backupUrl = makeTargetUrl(hostnames[backupIndex])

			// Create requests using original request as template
			const primaryRequest = new Request(primaryUrl.toString(), request)
			const backupRequest = new Request(backupUrl.toString(), request)
			console.log(`primary req: ${primaryUrl}`)
			console.log(`backup  req: ${backupUrl}`)

			// Start primary immediately
			const primaryFetch = fetch(primaryRequest)

			// Start backup after 2s delay
			const backupFetch = (async () => {
				await new Promise((r) => setTimeout(r, 2000))
				console.log(`Starting backup fetch: ${backupUrl.hostname}`)
				return fetch(backupRequest)
			})()

			// Race and return whichever finishes first
			return await Promise.race([primaryFetch, backupFetch])
		} catch (err) {
			if (err instanceof Error) {
				return new Response("Origin fetch error: " + err.message, { status: 502 })
			}
			return new Response("Unknown origin error", { status: 502 })
		}
	}
}
