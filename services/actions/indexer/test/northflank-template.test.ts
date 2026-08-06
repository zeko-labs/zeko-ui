import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

type Step = {
	ref?: string
	kind?: string
	spec?: {
		name?: string
		steps?: Step[]
		stages?: Array<{
			name?: string
			nfObjects?: Array<{ id?: string; type?: string }>
			releaseFlow?: unknown
		}>
		runtimeEnvironment?: Record<string, string>
		ports?: Array<{ domains?: string[] }>
		deployment?: unknown
	}
}

type Template = {
	spec: { spec: { steps: Step[] } }
	arguments: Record<string, string>
}

const template = JSON.parse(
	readFileSync(
		new URL("../../../../northflank/actions-indexer/project.json", import.meta.url),
		"utf8"
	)
) as Template
const workflowSteps = template.spec.spec.steps[1]?.spec?.steps ?? []
const findStep = (ref: string) => workflowSteps.find((step) => step.ref === ref)
const argumentReference = (name: string) => `\${args.${name}}`
const templateReference = (name: string) => `\${${name}}`

const releaseFlowStages = findStep("actions-indexer-pipeline")?.spec?.stages ?? []

describe("Actions Indexer Northflank template", () => {
	it("defines an isolated Sepolia deployment with the required runtime references", () => {
		const deployment = findStep("actions-indexer-sepolia-deployment")
		const runtime = deployment?.spec?.runtimeEnvironment
		const domain = deployment?.spec?.ports?.[0]?.domains

		expect(deployment?.kind).toBe("DeploymentService")
		expect(deployment?.spec?.name).toBe("actions-indexer-sepolia-deployment")
		expect(domain).toEqual(["sepolia.indexer.actions.zeko.io"])
		expect(template.arguments.SEPOLIA_DATABASE_URL).toBe("")
		expect(template.arguments.SEPOLIA_AUTH_TOKEN).toBe("")
		expect(template.arguments.SEPOLIA_L1_ARCHIVE_URL).toBe(
			"https://sepolia-gateway.zeko.io/graphql"
		)
		expect(template.arguments.SEPOLIA_L2_ARCHIVE_URL).toBe(
			"https://archive.sepolia.zeko.io/graphql"
		)
		expect(template.arguments.SEPOLIA_OUTER_PK).toBe(
			"B62qpggUSofPZcWqtgbmLVnSAzzjAqSXjyckLJaBeGmXiPnc2mGUfhf"
		)
		expect(template.arguments.SEPOLIA_INNER_PK).toBe(
			"B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1"
		)
		expect(template.arguments.SEPOLIA_L1_FINALITY).toBe("290")
		expect(template.arguments.SEPOLIA_L2_FINALITY_TIME_H).toBe("72")
		expect(runtime).toEqual({
			DATABASE_URL: argumentReference("SEPOLIA_DATABASE_URL"),
			AUTH_TOKEN: argumentReference("SEPOLIA_AUTH_TOKEN"),
			PORT: argumentReference("PORT"),
			L1_ARCHIVE_URL: argumentReference("SEPOLIA_L1_ARCHIVE_URL"),
			L2_ARCHIVE_URL: argumentReference("SEPOLIA_L2_ARCHIVE_URL"),
			OUTER_PK: argumentReference("SEPOLIA_OUTER_PK"),
			INNER_PK: argumentReference("SEPOLIA_INNER_PK"),
			ENVIRONMENT: "sepolia",
			L1_FINALITY: argumentReference("SEPOLIA_L1_FINALITY"),
			L2_FINALITY_TIME_H: argumentReference("SEPOLIA_L2_FINALITY_TIME_H")
		})
	})

	it("attaches Sepolia to a manual Staging release flow", () => {
		const stage = releaseFlowStages.find((candidate) => candidate.name === "Staging")
		const stageTarget = stage?.nfObjects?.[0]
		const releaseFlow = stage?.releaseFlow as
			| {
					spec?: { spec?: { spec?: { steps?: Step[] } } }
					triggers?: unknown[]
			  }
			| undefined
		const releaseSteps = releaseFlow?.spec?.spec?.spec?.steps ?? []

		expect(stageTarget).toEqual({
			id: templateReference("refs.actions-indexer-sepolia-deployment.id"),
			type: "service"
		})
		expect(releaseFlow?.triggers).toEqual([])
		expect(
			releaseSteps.some((step) => step.ref === "actions-indexer-sepolia-deployment-release")
		).toBe(true)
	})

	it("keeps existing testnet and mainnet pipeline targets separate", () => {
		const development = releaseFlowStages.find((stage) => stage.name === "Development")
		const production = releaseFlowStages.find((stage) => stage.name === "Production")

		expect(development?.nfObjects).toEqual([
			{ id: templateReference("refs.actions-indexer-deployment.id"), type: "service" }
		])
		expect(production?.nfObjects).toEqual([
			{ id: templateReference("refs.actions-indexer-mainnet-deployment.id"), type: "service" }
		])
	})
})
