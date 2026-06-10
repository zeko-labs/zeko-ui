import { createProxyHandler } from "@zeko/proxy-handler"

const primaryUrl = "https://devnet-archive-node-api.gcp.o1test.net"

export default {
	fetch: createProxyHandler({
		primaryUrl,
		options: {
			cors: {
				origins: ["*"]
			}
		}
	})
}
