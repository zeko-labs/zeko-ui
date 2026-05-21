import { createProxyHandler } from "@zeko/proxy-handler"

const hostnames = ["https://api.minascan.io/node/mainnet/v1/graphql"]

export default {
	fetch: createProxyHandler({
		hostnames,
		options: {
			cors: {
				origins: ["*"]
			}
		}
	})
}
