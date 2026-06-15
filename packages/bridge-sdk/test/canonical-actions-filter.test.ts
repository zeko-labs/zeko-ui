import { describe, expect, it } from "vitest"
import { selectCanonicalActionOutputs } from "../src/utils"

type ActionOutput = Parameters<typeof selectCanonicalActionOutputs>[0][number]

const buildOutput = (height: number, chainStatus: string): ActionOutput => ({
	blockInfo: { timestamp: `${height}`, height, chainStatus },
	actionState: {
		actionStateOne: `after-${height}`,
		actionStateTwo: `before-${height}`
	},
	actionData: [{ data: [`${height}`], transactionInfo: { hash: `hash-${height}` } }]
})

describe("selectCanonicalActionOutputs", () => {
	it("drops orphaned dead-fork blocks while keeping canonical and pending in order", () => {
		const outputs = [
			buildOutput(67, "canonical"),
			buildOutput(83, "orphaned"),
			buildOutput(144, "pending")
		]

		const canonical = selectCanonicalActionOutputs(outputs)

		expect(canonical.map((o) => o.blockInfo.height)).toEqual([67, 144])
		expect(canonical.every((o) => o.blockInfo.chainStatus !== "orphaned")).toBe(true)
	})

	it("excludes the orphaned block's action data from the result", () => {
		const outputs = [
			buildOutput(67, "canonical"),
			buildOutput(83, "orphaned"),
			buildOutput(144, "canonical")
		]

		const hashes = selectCanonicalActionOutputs(outputs).flatMap((o) =>
			o.actionData.map((a) => a.transactionInfo.hash)
		)

		expect(hashes).toEqual(["hash-67", "hash-144"])
		expect(hashes).not.toContain("hash-83")
	})

	it("returns an all-canonical list unchanged (no-op for healthy archives)", () => {
		const outputs = [buildOutput(200, "canonical"), buildOutput(201, "canonical")]

		expect(selectCanonicalActionOutputs(outputs)).toEqual(outputs)
	})

	it("keeps blocks whose status defaulted to canonical", () => {
		const outputs = [buildOutput(300, "canonical"), buildOutput(301, "pending")]

		expect(selectCanonicalActionOutputs(outputs).map((o) => o.blockInfo.height)).toEqual([300, 301])
	})
})
