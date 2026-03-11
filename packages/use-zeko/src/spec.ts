import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const requiredReferences = [
	"10-agent-workflows.md",
	"20-build-on-zeko.md",
	"30-bridge-sdk.md",
	"40-faucet-cli.md",
	"50-endpoints.md",
	"60-architecture.md",
	"copied/bridge-sdk-readme.md",
	"copied/faucet-cli-readme.md"
] as const

export type SyncedReference = {
	sourcePath: string
	targetPath: string
	title: string
	includeFromHeading: string
	stopBeforeHeading: string
}

export const syncedReferences: SyncedReference[] = [
	{
		sourcePath: "packages/bridge-sdk/README.md",
		targetPath: "references/copied/bridge-sdk-readme.md",
		title: "# Bridge SDK Reference",
		includeFromHeading: "## Installation",
		stopBeforeHeading: "## Development"
	},
	{
		sourcePath: "packages/faucet-cli/README.md",
		targetPath: "references/copied/faucet-cli-readme.md",
		title: "# Faucet CLI Reference",
		includeFromHeading: "## Installation",
		stopBeforeHeading: "## Development"
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
		name: "zeko archive graphql",
		expected: "https://archive.testnet.zeko.io/graphql",
		sources: ["apps/bridge-ui/machines/helpers.ts", "packages/graphql/moon.yml"]
	},
	{
		name: "mina gateway",
		expected: "gateway.mina.devnet.zeko.io",
		sources: ["services/mina-proxy/wrangler.jsonc"]
	},
	{
		name: "mina archive gateway",
		expected: "gateway.mina.archive.devnet.zeko.io",
		sources: ["services/mina-archive-proxy/wrangler.jsonc"]
	},
	{
		name: "minascan backup node",
		expected: "https://api.minascan.io/node/devnet/v1/graphql",
		sources: ["packages/graphql/moon.yml", "services/mina-proxy/worker.ts"]
	},
	{
		name: "minascan backup archive",
		expected: "https://api.minascan.io/archive/devnet/v1/graphql",
		sources: ["packages/graphql/moon.yml", "services/mina-archive-proxy/worker.ts"]
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

export type EvalCase = {
	id: string
	prompt: string
	expectedReferences: string[]
	expectedFragments: string[]
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const packageRoot = path.resolve(currentDir, "..")
export const repoRoot = path.resolve(packageRoot, "..", "..")

export const markdownPathAllowlist = ["references/", "SKILL.md", "README.md"]
export const forbiddenMarkdownPatterns = [
	/\b(?:apps|packages|services|docs)\/[^\s)`]+/g,
	/\.\.\//g,
	/\/Users\//g
]
export const skippedExternalLinkChecks = new Set(["https://docs.zeko.io/llms.txt"])

const evalPromptPath = path.join(packageRoot, "evals", "prompts.json")
export const evalCases = JSON.parse(fs.readFileSync(evalPromptPath, "utf8")) as EvalCase[]
