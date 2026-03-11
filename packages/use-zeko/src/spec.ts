import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const requiredReferences = [
	"01-navigation.md",
	"10-users.md",
	"20-build-on-zeko.md",
	"30-bridge.md",
	"40-faucet.md",
	"50-o1js-and-tooling.md",
	"60-networks-and-endpoints.md",
	"70-architecture-and-protocol.md",
	"80-troubleshooting-and-boundaries.md",
	"99-source-of-truth.md"
] as const

export type SourceFileCheck = {
	path: string
	description: string
	mustNotContain?: string[]
	optional?: boolean
}

export const sourceFileChecks: SourceFileCheck[] = [
	{
		path: "apps/docs/content/users/getting-started.md",
		description: "primary public user onboarding",
		mustNotContain: ["TODO", "TBD", "WIP"]
	},
	{
		path: "apps/docs/content/introduction/quick-start.md",
		description: "public docs router",
		mustNotContain: ["TODO", "TBD", "WIP"]
	},
	{
		path: "apps/docs/.vitepress/config.ts",
		description: "public docs routing"
	},
	{
		path: "apps/docs/content/public/_redirects",
		description: "LLMS redirect definitions",
		mustNotContain: []
	},
	{
		path: "packages/bridge-sdk/README.md",
		description: "bridge sdk workflow"
	},
	{
		path: "packages/faucet-cli/README.md",
		description: "faucet cli workflow"
	},
	{
		path: "packages/graphql/README.md",
		description: "graphql package usage"
	},
	{
		path: "apps/bridge-ui/machines/helpers.ts",
		description: "bridge runtime endpoints"
	},
	{
		path: "packages/graphql/moon.yml",
		description: "graphql schema endpoint generation"
	},
	{
		path: "packages/faucet-cli/src/api.rs",
		description: "faucet api endpoint"
	},
	{
		path: "docs/CODEBASE_MAP.md",
		description: "public system map"
	},
	{
		path: "../zeko/src/app/zeko/sequencer/README.md",
		description: "deep protocol sequencer reference",
		optional: true
	},
	{
		path: "../zeko/src/app/zeko/da_layer/README.md",
		description: "deep protocol da-layer reference",
		optional: true
	}
] as const

export type EndpointCheck = {
	name: string
	expected: string
	sources: string[]
}

export const endpointChecks: EndpointCheck[] = [
	{
		name: "zeko testnet graphql",
		expected: "https://testnet.zeko.io/graphql",
		sources: ["apps/bridge-ui/machines/helpers.ts", "packages/graphql/moon.yml"]
	},
	{
		name: "zeko testnet archive graphql",
		expected: "https://archive.testnet.zeko.io/graphql",
		sources: ["apps/bridge-ui/machines/helpers.ts", "packages/graphql/moon.yml"]
	},
	{
		name: "zeko mainnet graphql",
		expected: "https://mainnet.zeko.io/graphql",
		sources: ["apps/bridge-ui/machines/helpers.ts"]
	},
	{
		name: "zeko alphanet graphql",
		expected: "https://alphanet.zeko.io/graphql",
		sources: ["apps/bridge-ui/machines/helpers.ts"]
	},
	{
		name: "mina devnet proxy",
		expected: "gateway.mina.devnet.zeko.io",
		sources: ["services/mina-proxy/wrangler.jsonc"]
	},
	{
		name: "mina devnet archive proxy",
		expected: "gateway.mina.archive.devnet.zeko.io",
		sources: ["services/mina-archive-proxy/wrangler.jsonc"]
	},
	{
		name: "actions api url",
		expected: "https://api.actions.zeko.io/graphql",
		sources: ["apps/bridge-ui/machines/helpers.ts"]
	},
	{
		name: "actions api domain",
		expected: "api.actions.zeko.io",
		sources: ["services/actions/api/wrangler.jsonc"]
	},
	{
		name: "faucet claim api",
		expected: "https://api.faucet.zeko.io/claim",
		sources: ["packages/faucet-cli/src/api.rs"]
	},
	{
		name: "faucet api domain",
		expected: "api.faucet.zeko.io",
		sources: ["apps/faucet/wrangler.jsonc"]
	}
] as const

export const skippedExternalLinkChecks = new Set([
	"https://mainnet.zeko.io/graphql",
	"https://archive.mainnet.zeko.io/graphql",
	"https://alphanet.zeko.io/graphql",
	"https://archive.alphanet.zeko.io/graphql",
	"https://docs.zeko.io/llms.txt"
])

export type EvalCase = {
	id: string
	prompt: string
	expectedReferences: string[]
	expectedFragments: string[]
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const packageRoot = path.resolve(currentDir, "..")
export const repoRoot = path.resolve(packageRoot, "..", "..")

const evalPromptPath = path.join(packageRoot, "evals", "prompts.json")
export const evalCases = JSON.parse(fs.readFileSync(evalPromptPath, "utf8")) as EvalCase[]
