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
		name: "zeko sepolia graphql",
		documentedUrl: "https://sepolia-gateway.zeko.io/graphql",
		documentedSources: ["packages/zeko-skills/zeko/references/40-endpoints-and-curl.md"],
		deployedSources: ["northflank/actions-indexer/project.json"]
	},
	{
		name: "zeko sepolia archive graphql",
		documentedUrl: "https://archive.sepolia.zeko.io/graphql",
		documentedSources: ["packages/zeko-skills/zeko/references/40-endpoints-and-curl.md"],
		deployedSources: ["northflank/actions-indexer/project.json"]
	},
	{
		name: "sepolia actions api",
		documentedUrl: "https://sepolia.api.actions.zeko.io/graphql",
		documentedSources: ["packages/zeko-skills/zeko/references/40-endpoints-and-curl.md"],
		deployedSources: ["services/actions/api/wrangler.jsonc"]
	}
] as const

export const forbiddenMarkdownPatterns = [
	/\b(?:apps|packages|services|docs)\/[^\s)`]+/,
	/\.\.\//,
	/\/Users\//
]
export const skippedExternalLinkChecks = new Set<string>([
	"https://testnet.api.actions.zeko.io/graphql",
	"https://api.actions.zeko.io/graphql",
	"https://api.faucet.zeko.io/claim",
	"https://testnet.zeko.io/graphql",
	"https://archive.testnet.zeko.io/graphql",
	"https://testnet.bridge.zeko.io",
	"https://bridge.zeko.io",
	"https://faucet.zeko.io",
	"https://gateway.mina.devnet.zeko.io",
	"https://gateway.mina.archive.devnet.zeko.io",
	"https://gateway.mina.mainnet.zeko.io",
	"https://gateway.mina.archive.mainnet.zeko.io",
	"https://archive.mainnet.zeko.io/graphql",
	"https://mainnet.zeko.io/graphql"
])

export type EvalCase = {
	id: string
	prompt: string
	expectedReferences: string[]
	expectedFragments: string[]
}

const evalPromptPath = path.join(packageRoot, "evals", "prompts.json")
export const evalCases = JSON.parse(fs.readFileSync(evalPromptPath, "utf8")) as EvalCase[]
