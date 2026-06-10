import { createProxyHandler } from "@zeko/proxy-handler"

const primaryUrl = "https://api.minascan.io/node/devnet/v1/graphql"
const backupUrls: readonly string[] = ["https://mina.devnet.zeko.io/graphql"]

export default {
	fetch: createProxyHandler({
		primaryUrl,
		backupUrls,
		options: {
			cors: {
				origins: ["*"]
			}
		}
	})
}
