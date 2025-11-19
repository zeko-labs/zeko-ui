import { createProxyHandler } from "@zeko/proxy-handler"

const hostnames = [
	"https://api.minascan.io/node/devnet/v1/graphql",
	"https://mina.devnet.zeko.io/graphql"
]

export default {
	fetch: createProxyHandler({
		hostnames,
		options: { cors: { origins: ["https://zeko.io", "localhost"], subdomainWildcard: true } }
	})
}
