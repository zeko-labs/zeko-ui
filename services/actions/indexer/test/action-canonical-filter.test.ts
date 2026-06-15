import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { processArchiveBlocks, selectCanonicalBlocks } from "../src/action-processing/core"
import type { ArchiveAction } from "../src/action-processing/types"

/**
 * Real mainnet L2 archive payload captured for the inner withdrawal key
 * B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1 on 2026-06-13.
 *
 * The archive DB still held a re-genesis'd dead chain: heights 67 and 83 are
 * `orphaned` and height 144 is `canonical`. Both branches start from the empty
 * action state, so treating all three blocks as one linear chain throws
 * `invalid actions chain at index=2`. The canonical block (144) matches the live
 * daemon inner account action state below.
 */
type RawAction = {
	blockInfo: {
		timestamp: string
		height: number
		distanceFromMaxBlockHeight: number
		chainStatus: string
	}
	actionState: { actionStateOne: string; actionStateTwo: string }
	actionData: { data: string[]; transactionInfo: { hash: string } }[]
}

const LIVE_INNER_ACTION_STATE =
	"26077479096813022236874658706981732305841335139411625045249976672961109318180"
const CANONICAL_HEIGHT = 144
const ORPHANED_HEIGHTS = [67, 83]

const payload = JSON.parse(
	readFileSync(new URL("./fixtures/l2-mainnet-orphaned-actions.json", import.meta.url), "utf8")
) as { data: { actions: RawAction[] } }

const blocks: ArchiveAction[] = payload.data.actions.map((a) => ({
	blockInfo: {
		timestamp: String(a.blockInfo.timestamp),
		height: Number(a.blockInfo.height),
		distanceFromMaxBlockHeight: Number(a.blockInfo.distanceFromMaxBlockHeight),
		chainStatus: a.blockInfo.chainStatus
	},
	actionState: {
		actionStateOne: a.actionState.actionStateOne,
		actionStateTwo: a.actionState.actionStateTwo
	},
	actionData: a.actionData.map((ad) => ({
		data: ad.data,
		transactionInfo: { hash: ad.transactionInfo.hash }
	}))
}))

describe("selectCanonicalBlocks", () => {
	it("drops orphaned dead-chain blocks and keeps the canonical chain in order", () => {
		const canonical = selectCanonicalBlocks(blocks)

		expect(canonical).toHaveLength(1)
		expect(canonical[0].blockInfo.height).toBe(CANONICAL_HEIGHT)
		expect(canonical.map((b) => b.blockInfo.height)).not.toContain(ORPHANED_HEIGHTS[0])
		expect(canonical.map((b) => b.blockInfo.height)).not.toContain(ORPHANED_HEIGHTS[1])
		expect(canonical.every((b) => b.blockInfo.chainStatus !== "orphaned")).toBe(true)
	})

	it("processes cleanly after selection and yields the live canonical inner action", () => {
		const result = processArchiveBlocks({
			blocks: selectCanonicalBlocks(blocks),
			strategy: "main"
		})

		expect(result.events).toHaveLength(1)
		expect(result.events[0].afterActionState).toBe(LIVE_INNER_ACTION_STATE)
	})

	it("preserves canonical and pending blocks while dropping only orphaned ones", () => {
		const mixed: ArchiveAction[] = blocks.map((b, index) => ({
			...b,
			blockInfo: {
				...b.blockInfo,
				chainStatus: index === 0 ? "pending" : b.blockInfo.chainStatus
			}
		}))

		const canonical = selectCanonicalBlocks(mixed)
		const statuses = canonical.map((b) => b.blockInfo.chainStatus)

		expect(statuses).toContain("pending")
		expect(statuses).toContain("canonical")
		expect(statuses).not.toContain("orphaned")
	})
})

describe("regression: unfiltered orphaned chain (documents the original bug)", () => {
	it("throws invalid actions chain when orphaned blocks are not filtered", () => {
		expect(() => processArchiveBlocks({ blocks, strategy: "main" })).toThrow(
			/invalid actions chain at index=2/
		)
	})
})
