import fs from "node:fs"
import path from "node:path"
import { packageRoot } from "./config.js"

export const requiredReferences = [
	"10-navigation.md",
	"10-agent-workflows.md",
	"20-user-flows.md",
	"30-bridge-and-faucet.md",
	"40-endpoints-and-curl.md",
	"50-build-on-zeko.md",
	"60-sequencer-archive-and-da.md"
] as const

export const clawhubRequiredEnvVars = [
	"MINA_PRIVATE_KEY",
	"GITHUB_TOKEN",
	"PUBLIC_KEY",
	"ADDRESS"
] as const

export const clawhubRequiredBins = ["curl", "node", "npx"] as const

export const clawhubInstallPackages = [
	{ packageName: "@zeko-labs/bridge-cli", bins: ["zeko-bridge"] },
	{ packageName: "@zeko-labs/faucet-cli", bins: ["zeko-faucet"] },
	{ packageName: "o1js", bins: [] }
] as const

export const publicSyncMappings = [
	{ source: "README.md", target: "README.md" },
	{ source: "zeko", target: "skills/zeko" }
] as const

export type EndpointCheck = {
	name: string
	documentedUrl: string
	documentedSources: string[]
	deployedSources?: string[]
}

export const endpointChecks: EndpointCheck[] = [
	{
		name: "zeko testnet graphql",
		documentedUrl: "https://testnet.zeko.io/graphql",
		documentedSources: [
			"packages/zeko-skills/zeko/references/40-endpoints-and-curl.md",
			"packages/zeko-skills/zeko/references/30-bridge-and-faucet.md",
			"packages/zeko-skills/zeko/references/50-build-on-zeko.md"
		]
	},
	{
		name: "zeko archive graphql",
		documentedUrl: "https://archive.testnet.zeko.io/graphql",
		documentedSources: [
			"packages/zeko-skills/zeko/references/40-endpoints-and-curl.md",
			"packages/zeko-skills/zeko/references/30-bridge-and-faucet.md",
			"packages/zeko-skills/zeko/references/50-build-on-zeko.md"
		]
	},
	{
		name: "mina gateway devnet",
		documentedUrl: "https://gateway.mina.devnet.zeko.io",
		documentedSources: [
			"packages/zeko-skills/zeko/references/40-endpoints-and-curl.md",
			"packages/zeko-skills/zeko/references/30-bridge-and-faucet.md"
		],
		deployedSources: ["services/mina-proxy-devnet/wrangler.jsonc"]
	},
	{
		name: "mina gateway mainnet",
		documentedUrl: "https://gateway.mina.mainnet.zeko.io",
		documentedSources: [
			"packages/zeko-skills/zeko/references/40-endpoints-and-curl.md",
			"packages/zeko-skills/zeko/references/30-bridge-and-faucet.md"
		],
		deployedSources: ["services/mina-proxy-mainnet/wrangler.jsonc"]
	},
	{
		name: "mina archive gateway devnet",
		documentedUrl: "https://gateway.mina.archive.devnet.zeko.io",
		documentedSources: [
			"packages/zeko-skills/zeko/references/40-endpoints-and-curl.md",
			"packages/zeko-skills/zeko/references/30-bridge-and-faucet.md"
		],
		deployedSources: ["services/mina-archive-proxy-devnet/wrangler.jsonc"]
	},
	{
		name: "mina archive gateway mainnet",
		documentedUrl: "https://gateway.mina.archive.mainnet.zeko.io",
		documentedSources: [
			"packages/zeko-skills/zeko/references/40-endpoints-and-curl.md",
			"packages/zeko-skills/zeko/references/30-bridge-and-faucet.md"
		],
		deployedSources: ["services/mina-archive-proxy-mainnet/wrangler.jsonc"]
	},
	{
		name: "actions api",
		documentedUrl: "https://api.actions.zeko.io/graphql",
		documentedSources: [
			"packages/zeko-skills/zeko/references/40-endpoints-and-curl.md",
			"packages/zeko-skills/zeko/references/30-bridge-and-faucet.md"
		],
		deployedSources: ["services/actions/api/wrangler.jsonc"]
	},
	{
		name: "faucet claim api",
		documentedUrl: "https://api.faucet.zeko.io/claim",
		documentedSources: ["packages/zeko-skills/zeko/references/40-endpoints-and-curl.md"],
		deployedSources: ["apps/faucet/wrangler.jsonc"]
	}
] as const

export const forbiddenMarkdownPatterns = [
	/\b(?:apps|packages|services|docs)\/[^\s)`]+/,
	/\.\.\//,
	/\/Users\//
]
export const skippedExternalLinkChecks = new Set<string>([
	"https://gateway.mina.devnet.zeko.io",
	"https://gateway.mina.archive.devnet.zeko.io",
	"https://gateway.mina.mainnet.zeko.io",
	"https://gateway.mina.archive.mainnet.zeko.io"
])

export type EvalCase = {
	id: string
	prompt: string
	expectedReferences: string[]
	expectedFragments: string[]
}

const evalPromptPath = path.join(packageRoot, "evals", "prompts.json")
export const evalCases = JSON.parse(fs.readFileSync(evalPromptPath, "utf8")) as EvalCase[]
