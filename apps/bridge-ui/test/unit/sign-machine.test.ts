import type { ZkappCommand } from "@aurowallet/mina-provider"
import { describe, expect, it, vi } from "vitest"
import { createActor, toPromise } from "xstate"
import { signMachine } from "../../machines/sign"

describe("signMachine", () => {
	it("signs an SDK transaction without sending it", async () => {
		const user = "B62qtest-user"
		const signedCommand = {
			accountUpdates: [],
			feePayer: {
				authorization: "",
				body: {
					fee: "1",
					publicKey: user
				}
			},
			memo: ""
		} as unknown as ZkappCommand
		const sendTransaction = vi.fn(async () => ({
			signedData: JSON.stringify({ zkappCommand: signedCommand })
		}))
		vi.stubGlobal("mina", { sendTransaction })

		const actor = createActor(signMachine, {
			input: {
				transaction: JSON.stringify({
					accountUpdates: [],
					feePayer: { authorization: "", body: { fee: "0", publicKey: user } },
					memo: ""
				}),
				user
			}
		})

		actor.start()
		const output = await toPromise(actor)

		expect(output).toEqual({ signedTransaction: signedCommand })
		expect(sendTransaction).toHaveBeenCalledWith({
			onlySign: true,
			transaction: JSON.stringify({
				accountUpdates: [],
				feePayer: { authorization: "", body: { fee: "1", publicKey: user } },
				memo: ""
			})
		})

		actor.stop()
		vi.unstubAllGlobals()
	})

	it("passes opaque executable transaction strings to the wallet unchanged", async () => {
		const user = "B62qtest-user"
		const transaction = "7mX8vFnToS4pXmBkyDWPwiDUAJHAbaeB1jnNfBAPMAKuKvamaE3kpG6ekiy8ZP6"
		const signedCommand = {
			accountUpdates: [],
			feePayer: {
				authorization: "",
				body: {
					fee: "1",
					publicKey: user
				}
			},
			memo: ""
		} as unknown as ZkappCommand
		const sendTransaction = vi.fn(async () => ({
			signedData: JSON.stringify({ zkappCommand: signedCommand })
		}))
		vi.stubGlobal("mina", { sendTransaction })

		const actor = createActor(signMachine, {
			input: {
				transaction,
				user
			}
		})

		actor.start()
		const output = await toPromise(actor)

		expect(output).toEqual({ signedTransaction: signedCommand })
		expect(sendTransaction).toHaveBeenCalledWith({
			onlySign: true,
			transaction
		})

		actor.stop()
		vi.unstubAllGlobals()
	})

	it("can complete an SDK signature request after signing", async () => {
		const user = "B62qtest-user"
		const signedCommand = {
			accountUpdates: [],
			feePayer: {
				authorization: "",
				body: {
					fee: "1",
					publicKey: user
				}
			},
			memo: ""
		} as unknown as ZkappCommand
		const completeSignedTransaction = vi.fn(async () => "wallet-transaction-json")
		vi.stubGlobal("mina", {
			sendTransaction: vi.fn(async () => ({
				signedData: JSON.stringify({ zkappCommand: signedCommand })
			}))
		})

		const actor = createActor(signMachine, {
			input: {
				transaction: JSON.stringify({
					accountUpdates: [],
					feePayer: { authorization: "", body: { fee: "1", publicKey: user } },
					memo: ""
				}),
				user,
				complete: {
					requestId: "sdk-signature-request-1",
					completeSignedTransaction
				}
			}
		})

		actor.start()
		const output = await toPromise(actor)

		expect(completeSignedTransaction).toHaveBeenCalledWith({
			requestId: "sdk-signature-request-1",
			signedTransaction: signedCommand
		})
		expect(output).toEqual({
			signedTransaction: signedCommand,
			transaction: "wallet-transaction-json"
		})

		actor.stop()
		vi.unstubAllGlobals()
	})
})
