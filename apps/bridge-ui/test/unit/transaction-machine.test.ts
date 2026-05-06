import type { ZkappCommand } from "@aurowallet/mina-provider"
import type { Networks, walletMachine } from "@lumina-dex/sdk"
import { describe, expect, it, vi } from "vitest"
import type { ActorRefFromLogic } from "xstate"
import { createActor, setup, toPromise } from "xstate"
import type { OperationsWorker } from "../../machines/operations.worker"
import { transactionMachine } from "../../machines/transaction"

const createWalletActor = ({
	account,
	currentNetwork
}: {
	account: string
	currentNetwork: Networks
}): ActorRefFromLogic<typeof walletMachine> =>
	createActor(
		setup({
			types: {
				context: {} as { account: string; currentNetwork: Networks },
				events: {} as { type: string }
			}
		}).createMachine({
			context: { account, currentNetwork }
		})
	) as ActorRefFromLogic<typeof walletMachine>

describe("transactionMachine", () => {
	it("can sign an SDK transaction without sending it", async () => {
		const user = "B62qtest-user"
		const worker = {
			sendZkAppCommand: vi.fn()
		} as unknown as OperationsWorker
		const wallet = createWalletActor({ account: user, currentNetwork: "mina:devnet" })
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

		wallet.start()
		const actor = createActor(transactionMachine, {
			input: {
				id: "sdk-sign",
				transaction: JSON.stringify({
					accountUpdates: [],
					feePayer: { authorization: "", body: { fee: "0", publicKey: user } },
					memo: ""
				}),
				wallet,
				worker,
				mode: "sign"
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
		expect(worker.sendZkAppCommand).not.toHaveBeenCalled()

		actor.stop()
		wallet.stop()
		vi.unstubAllGlobals()
	})
})
