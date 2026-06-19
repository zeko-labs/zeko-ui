import { describe, expect, it } from "vitest"
import { PublicKey, UInt32, UInt64 } from "o1js"
import { fetchBridgeCommitStatusSnapshot, fetchLastCommit } from "../src/status"
import type { GqlClient } from "../src/graphql"
import type { BridgeRuntime } from "../src/runtime"

const publicKey = PublicKey.fromBase58("B62qmE663JH772AeC3LsSi6BUD6C3BK1KDUkqajtjyWAxaZZddQ2CE4")

const createClient = (onQuery?: (variables: Record<string, unknown>) => void): GqlClient => {
	const query = async (_document: unknown, variables: Record<string, unknown>) => {
		onQuery?.(variables)
		if (!("pk" in variables)) {
			return {
				data: {
					networkState: {
						maxBlockHeight: {
							canonicalMaxBlockHeight: 90,
							pendingMaxBlockHeight: 100
						}
					}
				}
			}
		}

		return {
			data: {
				actions: [
					{
						blockInfo: {
							timestamp: "1000",
							height: 10,
							chainStatus: "canonical",
							distanceFromMaxBlockHeight: 90
						},
						actionData: [
							{
								data: ["1", "old-non-commit"],
								transactionInfo: { hash: "old-non-commit-hash" }
							}
						]
					},
					{
						blockInfo: {
							timestamp: "3000",
							height: 30,
							chainStatus: "pending",
							distanceFromMaxBlockHeight: 70
						},
						actionData: [
							{
								data: ["0", "new-commit"],
								transactionInfo: { hash: "new-commit-hash" }
							}
						]
					},
					{
						blockInfo: {
							timestamp: "4000",
							height: 40,
							chainStatus: "orphaned",
							distanceFromMaxBlockHeight: 60
						},
						actionData: [
							{
								data: ["0", "orphaned-commit"],
								transactionInfo: { hash: "orphaned-commit-hash" }
							}
						]
					}
				]
			}
		}
	}

	return Object.assign(() => ({ query }), { label: "test-archive" }) as GqlClient
}

describe("bridge status helpers", () => {
	it("returns the newest non-orphaned commit action", async () => {
		const result = await fetchLastCommit(createClient(), publicKey)

		expect(result).toMatchObject({
			timestamp: "3000",
			timestampIso: "1970-01-01T00:00:03.000Z",
			height: 30,
			chainStatus: "pending",
			distanceFromMaxBlockHeight: 70,
			transactionHash: "new-commit-hash",
			data: ["0", "new-commit"]
		})
	})

	it("includes the archive tip block in the first query window", async () => {
		const calls: Array<Record<string, unknown>> = []

		await fetchLastCommit(
			createClient((variables) => {
				if ("pk" in variables) calls.push(variables)
			}),
			publicKey
		)

		expect(calls[0]).toMatchObject({
			from: 0,
			to: 101
		})
	})

	it("queries sequencer actions for the sequencer commit status", async () => {
		const innerPk = PublicKey.fromBase58("B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1")
		const sequencerPk = PublicKey.fromBase58(
			"B62qkekmS9273D1EsFfMSJMMDAmgvh1WyoYE2vs1r7k4GtGBqVYABn2"
		)
		const l2ActionPks: string[] = []
		const runtime = {
			config: {
				l1Url: "http://l1.test",
				l1ArchiveUrl: "http://l1-archive.test",
				zekoUrl: "http://l2.test",
				zekoArchiveUrl: "http://l2-archive.test",
				l1Network: "testnet",
				l2Network: "testnet",
				actionsApi: "http://actions.test"
			},
			l1Client: createClient(),
			l1ArchiveClient: createClient(),
			l2Client: createClient(),
			l2ArchiveClient: createClient((variables) => {
				if ("pk" in variables) l2ActionPks.push(String(variables.pk))
			}),
			actionsApiClient: createClient(),
			l1AccountCreationFee: UInt64.from(1),
			l2AccountCreationFee: UInt64.from(1),
			outerPk: publicKey,
			innerPk,
			outerHolders: [publicKey],
			innerHolder: publicKey,
			outerTokenOwner: publicKey,
			sequencerPk,
			withdrawalDelay: UInt32.from(10),
			bridgeFeeRecipientL1: publicKey,
			bridgeFeeRecipientL2: innerPk,
			bridgeProofFee: UInt64.from(1),
			V2_DEPOSITS_START_INDEX: UInt32.zero,
			V2_WITHDRAWALS_START_INDEX: UInt32.zero
		} satisfies BridgeRuntime

		await fetchBridgeCommitStatusSnapshot(runtime)

		expect(l2ActionPks).toEqual([sequencerPk.toBase58()])
	})
})
