import { PublicKey, UInt32, UInt64, type Field } from "o1js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Bridge, InsufficientBridgeTransferAmountError } from "../src/index"
import type { GqlClient } from "../src/graphql"
import type { BridgeRuntime } from "../src/runtime"
import type { Account, Config } from "../src/types"

const recipient = PublicKey.fromBase58("B62qpuhMDp748xtE77iBXRRaipJYgs6yumAeTzaM7zS9dn8avLPaeFF")
const holder = PublicKey.fromBase58("B62qmqHbTA6X54y5M2nSxpuPae5EUE2TBQXacAEqqgn667NRVFKDSeA")
const outerPk = PublicKey.fromBase58("B62qkekmS9273D1EsFfMSJMMDAmgvh1WyoYE2vs1r7k4GtGBqVYABn2")
const innerPk = PublicKey.fromBase58("B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1")

const bridgeConfig: Config = {
	l1Url: "http://l1.test",
	l1ArchiveUrl: "http://l1-archive.test",
	zekoUrl: "http://l2.test",
	zekoArchiveUrl: "http://l2-archive.test",
	l1Network: "testnet",
	l2Network: "testnet",
	actionsApi: "http://actions.test"
}

const buildGraphqlClient = (label: string): GqlClient =>
	Object.assign(
		() => ({
			query: async () => {
				throw new Error(`${label} raw account query should not be used`)
			}
		}),
		{ label }
	)

const buildBridge = () =>
	new Bridge({
		config: bridgeConfig,
		l1Client: buildGraphqlClient("l1"),
		l1ArchiveClient: buildGraphqlClient("l1-archive"),
		l2Client: buildGraphqlClient("l2"),
		l2ArchiveClient: buildGraphqlClient("l2-archive"),
		actionsApiClient: buildGraphqlClient("actions-api"),
		l1AccountCreationFee: UInt64.from(1_000_000_000),
		l2AccountCreationFee: UInt64.from(1_000_000_000),
		outerPk,
		innerPk,
		outerHolders: [holder],
		innerHolder: holder,
		outerTokenOwner: outerPk,
		sequencerPk: innerPk,
		withdrawalDelay: UInt32.from(10),
		bridgeFeeRecipientL1: outerPk,
		bridgeFeeRecipientL2: innerPk,
		bridgeProofFee: UInt64.from(100_000_000),
		V2_DEPOSITS_START_INDEX: UInt32.zero,
		V2_WITHDRAWALS_START_INDEX: UInt32.zero
	} satisfies BridgeRuntime)

const mockBridgeFetchAccount = (bridge: Bridge) => {
	const bridgeInternals = bridge as unknown as {
		fetchAccount: (client: GqlClient, pk: PublicKey, tokenId?: Field) => Promise<Account | null>
	}

	return vi.spyOn(bridgeInternals, "fetchAccount").mockResolvedValue(null)
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe("bridge transfer fee account checks", () => {
	it("uses the runtime account fetch hook before rejecting underfunded deposits", async () => {
		const bridge = buildBridge()
		const fetchAccount = mockBridgeFetchAccount(bridge)

		await expect(
			bridge.submitDeposit(
				recipient,
				{
					recipient,
					amount: UInt64.from(1),
					timeout: UInt32.from(10)
				},
				vi.fn()
			)
		).rejects.toThrow(InsufficientBridgeTransferAmountError)

		expect(fetchAccount).toHaveBeenCalledTimes(2)
	})

	it("uses the runtime account fetch hook before rejecting underfunded withdrawals", async () => {
		const bridge = buildBridge()
		const fetchAccount = mockBridgeFetchAccount(bridge)

		await expect(
			bridge.submitWithdrawal(
				recipient,
				{
					recipient,
					amount: UInt64.from(1)
				},
				vi.fn()
			)
		).rejects.toThrow(InsufficientBridgeTransferAmountError)

		expect(fetchAccount).toHaveBeenCalledTimes(2)
	})
})
