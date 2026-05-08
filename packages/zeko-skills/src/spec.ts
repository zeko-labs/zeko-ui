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
	expected: string | readonly string[]
	sources: string[]
}

export const endpointChecks: EndpointCheck[] = [
	{
		name: "zeko testnet graphql",
		expected: ["https://testnet.zeko.io/graphql", "https://alphanet.zeko.io/graphql"],
		sources: ["apps/bridge-ui/machines/helpers.ts", "packages/graphql/moon.yml"]
	},
	{
		name: "zeko archive graphql",
		expected: [
			"https://archive.testnet.zeko.io/graphql",
			"https://archive.alphanet.zeko.io/graphql"
		],
		sources: ["apps/bridge-ui/machines/helpers.ts", "packages/graphql/moon.yml"]
	},
	{
		name: "zeko mainnet graphql",
		expected: "https://mainnet.zeko.io/graphql",
		sources: ["apps/bridge-ui/machines/helpers.ts"]
	},
	{
		name: "zeko mainnet archive",
		expected: "https://archive.mainnet.zeko.io/graphql",
		sources: ["apps/bridge-ui/machines/helpers.ts"]
	},
	{
		name: "zeko alphanet graphql",
		expected: "https://alphanet.zeko.io/graphql",
		sources: ["apps/bridge-ui/machines/helpers.ts"]
	},
	{
		name: "zeko alphanet archive",
		expected: "https://archive.alphanet.zeko.io/graphql",
		sources: ["apps/bridge-ui/machines/helpers.ts"]
	},
	{
		name: "mina gateway",
		expected: ["https://gateway.mina.devnet.zeko.io", "gateway.mina.devnet.zeko.io"],
		sources: [
			"apps/bridge-ui/machines/helpers.ts",
			"packages/graphql/moon.yml",
			"services/mina-proxy/wrangler.jsonc"
		]
	},
	{
		name: "mina archive gateway",
		expected: [
			"https://gateway.mina.archive.devnet.zeko.io",
			"gateway.mina.archive.devnet.zeko.io"
		],
		sources: [
			"apps/bridge-ui/machines/helpers.ts",
			"packages/graphql/moon.yml",
			"services/mina-archive-proxy/wrangler.jsonc"
		]
	},
	{
		name: "actions api",
		expected: "https://api.actions.zeko.io/graphql",
		sources: ["apps/bridge-ui/machines/helpers.ts"]
	},
	{
		name: "faucet claim api",
		expected: "https://api.faucet.zeko.io/claim",
		sources: ["packages/faucet-cli/src/api.rs"]
	}
] as const

export const forbiddenMarkdownPatterns = [
	/\b(?:apps|packages|services|docs)\/[^\s)`]+/,
	/\.\.\//,
	/\/Users\//
]
export const skippedExternalLinkChecks = new Set<string>()

export type EvalCase = {
	id: string
	prompt: string
	expectedReferences: string[]
	expectedFragments: string[]
}

const evalPromptPath = path.join(packageRoot, "evals", "prompts.json")
export const evalCases = JSON.parse(fs.readFileSync(evalPromptPath, "utf8")) as EvalCase[]
