import { describe, expect, it } from "vitest"
import { PublicKey } from "o1js"
import { fetchLastCommit } from "../src/status"
import type { GqlClient } from "../src/graphql"

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
})
