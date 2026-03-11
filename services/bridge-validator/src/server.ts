import { createServer } from "inngest/node"
import { functions, inngest } from "./functions"

export const startServer = ({ port = Number(process.env.PORT ?? 3000) } = {}) => {
	const server = createServer({
		client: inngest,
		functions
	})

	server.listen(port)
	return server
}

if (process.argv[1]?.endsWith("server.js") || process.argv[1]?.endsWith("server.ts")) {
	startServer()
}
