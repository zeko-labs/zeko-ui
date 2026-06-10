import { createProxyHandler } from "@zeko/proxy-handler"

const primaryUrl = "https://archive-node-api.gcp.o1test.net"
const backupUrls: readonly string[] = ["https://mina-archive.mainnet.zeko.io/graphql"]

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
