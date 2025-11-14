export interface CorsOptions {
	/** List of allowed origins. Use ["*"] to allow all origins, ["localhost"] to allow all localhost ports (e.g., "https://example.com", "http://localhost:3000") */
	origins: string[]
	/** If true, allows all subdomains of the specified origins (default: false) */
	subdomainWildcard?: boolean
}

export interface ProxyHandlerOptions {
	/** Delay in milliseconds before starting the backup request (default: 2000) */
	backupDelay?: number
	/** CORS configuration. If not provided, CORS is disabled */
	cors?: CorsOptions
}

function getRandomInt(max: number): number {
	return Math.floor(Math.random() * max)
}

function isOriginAllowed(params: {
	requestOrigin: string
	allowedOrigins: string[]
	subdomainWildcard: boolean
}): boolean {
	const { requestOrigin, allowedOrigins, subdomainWildcard } = params

	return allowedOrigins.some((allowed) => {
		// Wildcard - allow all origins
		if (allowed === "*") return true

		// Localhost wildcard - allow all localhost ports
		if (allowed === "localhost") {
			try {
				const requestUrl = new URL(requestOrigin)
				return requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1"
			} catch (error) {
				console.error(`Invalid request origin: "${requestOrigin}"`, error)
				return false
			}
		}

		// Exact match
		if (allowed === requestOrigin) return true

		// If subdomainWildcard is enabled, check for subdomain matches
		if (subdomainWildcard) {
			try {
				const allowedUrl = new URL(allowed)
				const requestUrl = new URL(requestOrigin)

				const allowedHost = allowedUrl.hostname
				const requestHost = requestUrl.hostname

				// Check if request is a subdomain of allowed origin
				// e.g., allowed: example.com, request: sub.example.com or example.com
				return requestHost === allowedHost || requestHost.endsWith(`.${allowedHost}`)
			} catch (error) {
				console.error(`Invalid URL in allowedOrigins: "${allowed}"`, error)
			}
		}

		return false
	})
}

function getCorsHeaders(params: {
	requestOrigin: string | null
	corsConfig: CorsOptions
}): Record<string, string> {
	const { requestOrigin, corsConfig } = params
	const headers: Record<string, string> = {
		"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "*",
		"Access-Control-Max-Age": "86400"
	}

	// Check if wildcard is in origins
	const hasWildcard = corsConfig.origins.includes("*")

	if (hasWildcard) {
		headers["Access-Control-Allow-Origin"] = "*"
	} else if (
		requestOrigin &&
		isOriginAllowed({
			requestOrigin,
			allowedOrigins: corsConfig.origins,
			subdomainWildcard: corsConfig.subdomainWildcard ?? false
		})
	) {
		headers["Access-Control-Allow-Origin"] = requestOrigin
		headers["Access-Control-Allow-Credentials"] = "true"
	}

	return headers
}

function responseWithCors(params: {
	response: Response
	requestOrigin: string | null
	corsConfig: CorsOptions
}): Response {
	const { response, requestOrigin, corsConfig } = params
	const newHeaders = new Headers(response.headers)
	const corsHeaders = getCorsHeaders({ requestOrigin, corsConfig })
	for (const [key, value] of Object.entries(corsHeaders)) {
		newHeaders.set(key, value)
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: newHeaders
	})
}

/**
 * Creates a proxy request handler that forwards requests to backend hostnames
 * with automatic failover support.
 *
 * @param hostnames - Array of backend URLs to proxy requests to
 * @param options - Configuration options for the proxy handler
 * @returns A function that accepts a Request and returns a Promise<Response>
 */
export function createProxyHandler(params: {
	hostnames: readonly string[]
	options?: ProxyHandlerOptions
}): (request: Request) => Promise<Response> {
	const { hostnames, options = {} } = params
	const { backupDelay = 2000, cors } = options

	return async (request: Request): Promise<Response> => {
		const requestOrigin = request.headers.get("Origin")

		// Handle CORS preflight early
		if (cors && request.method === "OPTIONS") {
			return new Response(null, {
				headers: getCorsHeaders({ requestOrigin, corsConfig: cors })
			})
		}

		// Preserve original URL
		const sourceUrl = new URL(request.url)

		// Pick primary and backup hosts once
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
			const joinedPath = `${baseUrl.pathname.replace(/\/$/, "")}/${sourceUrl.pathname.replace(/^\//, "")}`
			baseUrl.pathname = joinedPath
			baseUrl.search = sourceUrl.search
			return baseUrl
		}

		const primaryUrl = makeTargetUrl(hostnames[primaryIndex])
		const backupUrl = makeTargetUrl(hostnames[backupIndex])

		// Handle Websocket upgrade requests
		const upgradeHeader = request.headers.get("Upgrade")
		if (upgradeHeader?.toLowerCase() === "websocket") {
			return fetch(new Request(primaryUrl.toString(), request))
		}

		try {
			// Create requests using original request as template
			const primaryRequest = new Request(primaryUrl.toString(), request)
			const backupRequest = new Request(backupUrl.toString(), request)
			console.log(`primary req: ${primaryUrl}`)
			console.log(`backup  req: ${backupUrl}`)

			const fetches = [fetch(primaryRequest)]
			if (hostnames.length > 1) {
				fetches.push(
					(async () => {
						await new Promise((r) => setTimeout(r, backupDelay))
						return fetch(backupRequest)
					})()
				)
			}

			const response = await Promise.race(fetches)

			// Websocket HTTPS fix
			// TODO: Remove this when upstream is fixed.
			const contentType = response.headers.get("content-type")
			if (contentType?.includes("text/html")) {
				const text = await response.text()
				const workerUrl = new URL(request.url)

				const fixedText =
					workerUrl.protocol === "https:" ? text.replace(/ws:\/\//g, "wss://") : text

				const fixedResponse = new Response(fixedText, {
					status: response.status,
					statusText: response.statusText,
					headers: response.headers
				})

				return cors
					? responseWithCors({ response: fixedResponse, requestOrigin, corsConfig: cors })
					: fixedResponse
			}

			return cors ? responseWithCors({ response, requestOrigin, corsConfig: cors }) : response
		} catch (err) {
			const errorResponse =
				err instanceof Error
					? new Response(`Origin fetch error: ${err.message}`, { status: 502 })
					: new Response("Unknown origin error", { status: 502 })

			return cors
				? responseWithCors({ response: errorResponse, requestOrigin, corsConfig: cors })
				: errorResponse
		}
	}
}
