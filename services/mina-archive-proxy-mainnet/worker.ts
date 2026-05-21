import { createProxyHandler } from "@zeko/proxy-handler"

const hostnames = ["https://archive-node-api.gcp.o1test.net"]

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
