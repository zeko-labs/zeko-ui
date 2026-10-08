import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import handler from "./index"

const DEFAULT_PORT = 9100
const DEFAULT_HOST = "0.0.0.0"
const BODYLESS_METHODS = new Set(["GET", "HEAD"])

// The generated Worker Env type declares the Hyperdrive bindings
// unconditionally. The standalone process has none, and src/db.ts selects the
// direct DATABASE_URL client when they are absent, so only the string
// variables are supplied here.
type StandaloneEnv = Omit<Env, "HYPERDRIVE" | "HYPERDRIVE_NO_CACHE">

// The Worker handler types its request with Cloudflare's incoming `cf`
// properties. Nothing in the handler reads `request.cf`, so a plain Request is
// handed over under that type.
type WorkerRequest = Request<unknown, IncomingRequestCfProperties>

const readEnv = (): StandaloneEnv => {
	const databaseUrl = process.env.DATABASE_URL
	if (!databaseUrl) throw new Error("DATABASE_URL is required to run the Actions API standalone")
	return {
		DATABASE_URL: databaseUrl,
		ENVIRONMENT: process.env.ENVIRONMENT ?? ""
	}
}

const createExecutionContext = (): ExecutionContext => ({
	waitUntil: (promise) => {
		promise.catch((error: unknown) => {
			console.error("[standalone] background task failed", error)
		})
	},
	passThroughOnException: () => {},
	props: {}
})

const readBody = async (request: IncomingMessage) => {
	const chunks: Buffer[] = []
	for await (const chunk of request) chunks.push(chunk)
	return Buffer.concat(chunks)
}

const toRequestHeaders = (request: IncomingMessage) => {
	const headers = new Headers()
	for (const [name, values] of Object.entries(request.headersDistinct)) {
		for (const value of values ?? []) headers.append(name, value)
	}
	return headers
}

const toWorkerRequest = async (request: IncomingMessage) => {
	const method = request.method ?? "GET"
	const url = `http://${request.headers.host ?? "localhost"}${request.url ?? "/"}`
	const body = BODYLESS_METHODS.has(method) ? null : await readBody(request)
	return new Request(url, { method, headers: toRequestHeaders(request), body }) as WorkerRequest
}

const writeResponse = async (response: Response, serverResponse: ServerResponse) => {
	serverResponse.statusCode = response.status
	response.headers.forEach((value, name) => {
		serverResponse.appendHeader(name, value)
	})
	if (response.body) {
		for await (const chunk of response.body) serverResponse.write(chunk)
	}
	serverResponse.end()
}

const env = readEnv() as Env
const host = process.env.HOST ?? DEFAULT_HOST
const port = Number(process.env.PORT) || DEFAULT_PORT

const handleRequest = async (request: IncomingMessage, serverResponse: ServerResponse) => {
	const workerRequest = await toWorkerRequest(request)
	const response = await handler.fetch(workerRequest, env, createExecutionContext())
	await writeResponse(response, serverResponse)
}

const server = createServer((request, serverResponse) => {
	handleRequest(request, serverResponse).catch((error: unknown) => {
		console.error("[standalone] request failed", error)
		if (!serverResponse.headersSent) serverResponse.statusCode = 500
		serverResponse.end()
	})
})

server.listen(port, host, () => {
	console.log(`Actions API standalone listening on ${host}:${port}`)
})

process.on("SIGTERM", () => {
	server.close(() => process.exit(0))
})
