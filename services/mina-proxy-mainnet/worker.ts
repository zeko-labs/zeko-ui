import { createProxyHandler } from "@zeko/proxy-handler"

const primaryUrl = "https://api.minascan.io/node/mainnet/v1/graphql"

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
