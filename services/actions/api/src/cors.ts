export const ACTIONS_API_SEPOLIA_CORS_ORIGIN = "https://sepolia.bridge.zeko.io"

export type ActionsApiCorsOptions = {
	origin: string
	credentials: boolean
	allowedHeaders: string[]
	methods: string[]
	exposedHeaders: string[]
}

export const getActionsApiCorsOptions = (
	environment: string,
	request: Request
): ActionsApiCorsOptions => {
	const requestOrigin = request.headers.get("Origin")
	const origin =
		environment === "sepolia" ? ACTIONS_API_SEPOLIA_CORS_ORIGIN : requestOrigin ?? "localhost:4000"

	return {
		origin,
		credentials: true,
		allowedHeaders: [request.headers.get("Access-Control-Request-Headers") ?? "Content-Type"],
		methods: ["*"],
		exposedHeaders: ["*"]
	}
}
