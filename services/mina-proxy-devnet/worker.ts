import { createProxyHandler } from "@zeko/proxy-handler"

const primaryUrl = "https://api.minascan.io/node/devnet/v1/graphql"

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
