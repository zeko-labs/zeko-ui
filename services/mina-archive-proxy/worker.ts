import { createProxyHandler } from "@zeko/proxy-handler"

// TODO: Staketab archive is not working somehow
const hostnames = [
	// "https://zeko-mina-archive.staketab.com",
	"https://devnet-archive-node-api.gcp.o1test.net"
]

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
