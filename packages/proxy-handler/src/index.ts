export interface CorsOptions {
	/** List of allowed origins. Use ["*"] to allow all origins, ["localhost"] to allow all localhost ports (e.g., "https://example.com", "http://localhost:3000") */
	origins: string[]
	/** If true, allows all subdomains of the specified origins (default: false) */
	subdomainWildcard?: boolean
}

export interface ProxyHandlerOptions {
	/** CORS configuration. If not provided, CORS is disabled */
	cors?: CorsOptions
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

type ProxyHandlerParams = {
	primaryUrl: string
	backupUrls?: readonly string[]
	options?: ProxyHandlerOptions
}

/**
 * Creates a proxy request handler that forwards requests to a primary backend URL
 * and sequentially tries backup URLs when a backend fails or returns 5xx.
 *
 * @param primaryUrl - Primary backend URL to proxy requests to
 * @param backupUrls - Ordered backup backend URLs to try after primary failures
 * @param options - Configuration options for the proxy handler
 * @returns A function that accepts a Request and returns a Promise<Response>
 */
export function createProxyHandler(
	params: ProxyHandlerParams
): (request: Request) => Promise<Response> {
	const { primaryUrl, backupUrls = [], options = {} } = params
	const { cors } = options
	const backendUrls = [primaryUrl, ...backupUrls]

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

		// Combine backend base URL + original path + query
		const makeTargetUrl = (base: string) => {
			const baseUrl = new URL(base)
			const joinedPath = `${baseUrl.pathname.replace(/\/$/, "")}/${sourceUrl.pathname.replace(/^\//, "")}`
			baseUrl.pathname = joinedPath
			baseUrl.search = sourceUrl.search
			return baseUrl
		}

		const applyResponseTransforms = async (response: Response): Promise<Response> => {
			// Websocket HTTPS fix
			// TODO: Remove this when upstream is fixed.
			const contentType = response.headers.get("content-type")
			if (contentType?.includes("text/html")) {
				const text = await response.text()
				const workerUrl = new URL(request.url)

				const fixedText =
					workerUrl.protocol === "https:" ? text.replace(/ws:\/\//g, "wss://") : text

				return new Response(fixedText, {
					status: response.status,
					statusText: response.statusText,
					headers: response.headers
				})
			}

			return response
		}

		const finalizeResponse = async (response: Response): Promise<Response> => {
			const transformedResponse = await applyResponseTransforms(response)
			return cors
				? responseWithCors({
						response: transformedResponse,
						requestOrigin,
						corsConfig: cors
					})
				: transformedResponse
		}

		const createProxyErrorResponse = (err: unknown): Response =>
			err instanceof Error
				? new Response(`Origin fetch error: ${err.message}`, { status: 502 })
				: new Response("Unknown origin error", { status: 502 })

		const upgradeHeader = request.headers.get("Upgrade")
		if (upgradeHeader?.toLowerCase() === "websocket") {
			return fetch(new Request(makeTargetUrl(primaryUrl).toString(), request))
		}

		const cancelResponseBody = (response: Response) => {
			if (response.body) {
				void response.body.cancel().catch(() => undefined)
			}
		}

		let lastUnavailableResponse: Response | undefined
		let lastError: unknown

		for (const [index, backendUrl] of backendUrls.entries()) {
			const targetUrl = makeTargetUrl(backendUrl)

			if (index > 0) {
				console.log(`Trying backup backend ${index}: ${targetUrl}`)
			}

			try {
				const requestBodySource = index < backendUrls.length - 1 ? request.clone() : request
				const response = await fetch(new Request(targetUrl.toString(), requestBodySource))

				if (response.status >= 500) {
					if (lastUnavailableResponse) {
						cancelResponseBody(lastUnavailableResponse)
					}
					lastUnavailableResponse = response
					console.log(`Backend unavailable (${response.status}): ${targetUrl}`)
					continue
				}

				return finalizeResponse(response)
			} catch (err) {
				lastError = err
				console.log(`Backend fetch failed: ${targetUrl}`, err)
			}
		}

		console.log("All proxy backends failed")

		if (lastUnavailableResponse) {
			return finalizeResponse(lastUnavailableResponse)
		}

		const errorResponse = createProxyErrorResponse(lastError)
		return cors
			? responseWithCors({ response: errorResponse, requestOrigin, corsConfig: cors })
			: errorResponse
	}
}
