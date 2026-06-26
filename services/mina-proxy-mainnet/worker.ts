import { createProxyHandler } from "@zeko/proxy-handler"

const primaryUrl = "https://api.minascan.io/node/mainnet/v1/graphql"
const backupUrls: readonly string[] = ["https://mina.mainnet.zeko.io/graphql"]

export default {
	fetch: createProxyHandler({
		primaryUrl,
		backupUrls,
		options: {
			cors: {
				origins: ["*"]
			},
			upstreamTimeoutMs: 3_000
		}
	})
}
