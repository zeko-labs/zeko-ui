const hostnames = [
	"https://zeko-mina-archive.staketab.com",
	"https://api.minascan.io/archive/devnet/v1/graphql"
]

function getRandomInt(max: number): number {
	return Math.floor(Math.random() * max)
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url)

		// Randomly pick the primary host
		const primaryIndex = getRandomInt(hostnames.length)
		url.hostname = hostnames[primaryIndex]

		const primaryRequest = new Request(url, request)

		// Pick a *different* backup host (if possible)
		let backupIndex = primaryIndex
		if (hostnames.length > 1) {
			do {
				backupIndex = getRandomInt(hostnames.length)
			} while (backupIndex === primaryIndex)
		}

		const backupUrl = new URL(request.url)
		backupUrl.hostname = hostnames[backupIndex]
		const backupRequest = new Request(backupUrl, request)

		// Implement the failover logic
		try {
			const primaryFetch = fetch(primaryRequest)

			// Wait 2 seconds, and *then* start the backup fetch.
			const backupFetch = new Promise<Response>((resolve) => {
				setTimeout(() => {
					console.log(`Primary fetch timed out, racing with backup: ${backupUrl.hostname}`)
					resolve(fetch(backupRequest))
				}, 2000)
			})

			return await Promise.race([primaryFetch, backupFetch])
		} catch (e) {
			if (e instanceof Error) {
				return new Response("Origin fetch error: " + e.message, { status: 502 })
			}
			return new Response("Unknown origin error", { status: 502 })
		}
	}
}
