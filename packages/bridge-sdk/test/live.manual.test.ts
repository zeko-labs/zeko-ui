import { describe, expect, it } from "vitest"
import { PublicKey } from "o1js"
import { Bridge, type Config } from "../src/index"

const liveConfig: Config = {
	l1Url: process.env.BRIDGE_SDK_L1_URL?.trim() || "https://gateway.mina.devnet.zeko.io",
	l1ArchiveUrl:
		process.env.BRIDGE_SDK_L1_ARCHIVE_URL?.trim() || "https://gateway.mina.archive.devnet.zeko.io",
	zekoUrl: process.env.BRIDGE_SDK_L2_URL?.trim() || "https://testnet.zeko.io/graphql",
	zekoArchiveUrl:
		process.env.BRIDGE_SDK_L2_ARCHIVE_URL?.trim() || "https://archive.testnet.zeko.io/graphql",
	actionsApi:
		process.env.BRIDGE_SDK_ACTIONS_API_URL?.trim() || "https://api.actions.zeko.io/graphql",
	l1Network: "testnet",
	l2Network: "testnet"
}

const walletAddress =
	process.env.BRIDGE_SDK_WALLET_ADDRESS?.trim() ||
	"B62qpuhMDp748xtE77iBXRRaipJYgs6yumAeTzaM7zS9dn8avLPaeFF"

describe("bridge-sdk live", () => {
	it("keeps live read-only deposit state APIs aligned", async () => {
		const bridge = await Bridge.init(liveConfig)
		const recipient = PublicKey.fromBase58(walletAddress)

		const [depositsWithStates, canFinalizeDeposit, canCancelDeposit] = await Promise.all([
			bridge.fetchDepositsWithStates(recipient),
			bridge.canFinalizeDeposit(recipient),
			bridge.canCancelDeposit(recipient)
		])

		expect(Array.isArray(depositsWithStates.deposits)).toBe(true)
		expect(typeof depositsWithStates.syncedIndex).toBe("number")
		expect(typeof depositsWithStates.acceptedIndex).toBe("number")
		expect(typeof depositsWithStates.confirmedIndex).toBe("number")
		expect(typeof depositsWithStates.finalisedIndex).toBe("number")
		expect(typeof depositsWithStates.cancelledIndex).toBe("number")
		expect(typeof canFinalizeDeposit.available).toBe("boolean")
		expect(
			canFinalizeDeposit.reason === null || typeof canFinalizeDeposit.reason === "string"
		).toBe(true)
		expect(typeof canCancelDeposit.available).toBe("boolean")
		expect(canCancelDeposit.reason === null || typeof canCancelDeposit.reason === "string").toBe(
			true
		)

		for (const deposit of depositsWithStates.deposits) {
			expect(typeof deposit.cancellable).toBe("boolean")
			expect(typeof deposit.cancelled).toBe("boolean")
			expect(typeof deposit.finalised).toBe("boolean")

			if (deposit.cancelled || deposit.finalised) {
				expect(deposit.cancellable).toBe(false)
			}
		}

		expect(canCancelDeposit.available).toBe(
			depositsWithStates.deposits.some((deposit) => deposit.cancellable)
		)
	}, 30_000)
})
