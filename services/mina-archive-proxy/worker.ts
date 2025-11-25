import { createProxyHandler } from "@zeko/proxy-handler"

// TODO: Staketab archive is not working somehow
const hostnames = [
	// "https://zeko-mina-archive.staketab.com",
	"https://api.minascan.io/archive/devnet/v1/graphql"
]

export default {
	fetch: createProxyHandler({
		hostnames,
		options: { cors: { origins: ["https://zeko.io", "localhost"], subdomainWildcard: true } }
	})
}
