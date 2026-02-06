import { createProxyHandler } from "@zeko/proxy-handler"

const hostnames = ["https://api.minascan.io/node/devnet/v1/graphql"]

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
