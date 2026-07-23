import { Field, PublicKey, UInt32, UInt64 } from "o1js"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { GqlClient } from "../src/graphql"
import { Bridge, ethereumDepositAux } from "../src/index"
import type { BridgeRuntime } from "../src/runtime"
import type { Deposit, OuterWitness } from "../src/types"
import * as utils from "../src/utils"

const recipient = PublicKey.fromBase58("B62qpuhMDp748xtE77iBXRRaipJYgs6yumAeTzaM7zS9dn8avLPaeFF")
const holder = PublicKey.fromBase58("B62qmqHbTA6X54y5M2nSxpuPae5EUE2TBQXacAEqqgn667NRVFKDSeA")
const outerPk = PublicKey.fromBase58("B62qkekmS9273D1EsFfMSJMMDAmgvh1WyoYE2vs1r7k4GtGBqVYABn2")
const innerPk = PublicKey.fromBase58("B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1")

const buildGraphqlClient = (): GqlClient =>
	Object.assign(
		() =>
			({
				query: async () => ({})
			}) as unknown as ReturnType<GqlClient>,
		{ label: "test-client" }
	)

const buildBridge = () =>
	new Bridge({
		config: {
			l1Url: "http://l1.test",
			l1ArchiveUrl: "http://l1-archive.test",
			zekoUrl: "http://l2.test",
			zekoArchiveUrl: "http://l2-archive.test",
			l1Network: "testnet",
			l2Network: "testnet",
			actionsApi: "http://actions.test"
		},
		l1Client: buildGraphqlClient(),
		l1ArchiveClient: buildGraphqlClient(),
		l2Client: buildGraphqlClient(),
		l2ArchiveClient: buildGraphqlClient(),
		actionsApiClient: buildGraphqlClient(),
		l1AccountCreationFee: UInt64.from(1),
		l2AccountCreationFee: UInt64.from(1),
		outerPk,
		innerPk,
		outerHolders: [holder],
		innerHolder: holder,
		outerTokenOwner: outerPk,
		sequencerPk: innerPk,
		withdrawalDelay: UInt32.from(10),
		bridgeFeeRecipientL1: outerPk,
		bridgeFeeRecipientL2: innerPk,
		bridgeProofFee: UInt64.from(1),
		V2_DEPOSITS_START_INDEX: UInt32.zero,
		V2_WITHDRAWALS_START_INDEX: UInt32.zero,
		bridge: { depositAux: ethereumDepositAux }
	} satisfies BridgeRuntime)

const deposit: Deposit = {
	recipient,
	amount: UInt64.from(3_000_000_000),
	timeout: UInt32.from(1),
	holderAccountL1: holder
}

const witness: OuterWitness = {
	action: [Field(1), Field(2)],
	afterActionState: Field(3),
	beforeActionState: Field(4),
	hash: "ethereum-deposit",
	index: 0,
	slotRange: {
		lower: UInt32.zero,
		upper: UInt32.MAXINT()
	},
	timestamp: "1700000000000",
	type: "witness",
	aux: ethereumDepositAux(deposit)
}

const arrangeDeposit = ({
	bridge,
	syncedState,
	syncedLength,
	minaCancelledCursor,
	finalityStatus = "canonical"
}: {
	bridge: Bridge
	syncedState: Field
	syncedLength: UInt32
	minaCancelledCursor?: number
	finalityStatus?: "pending" | "canonical"
}) => {
	const internals = bridge as unknown as {
		fetchAccount: (...args: unknown[]) => Promise<null>
		fetchSyncedOuterActionState: () => Promise<{ state: Field; length: UInt32 }>
		fetchUserDeposits: (pk: PublicKey) => Promise<Deposit[]>
	}
	vi.spyOn(internals, "fetchUserDeposits").mockResolvedValue([deposit])
	const fetchAccount = vi.spyOn(internals, "fetchAccount")
	if (minaCancelledCursor === undefined) {
		fetchAccount.mockResolvedValue(null)
	} else {
		fetchAccount
			.mockResolvedValueOnce({ zkappState: [`${minaCancelledCursor}`] })
			.mockResolvedValueOnce(null)
	}
	vi.spyOn(internals, "fetchSyncedOuterActionState").mockResolvedValue({
		state: syncedState,
		length: syncedLength
	})
	const indexedWitness = { ...witness, finalityStatus }
	vi.spyOn(utils, "fetchOuterWitnessesFromAuxes").mockResolvedValue([indexedWitness])
	vi.spyOn(utils, "fetchOuterActionsFromIndexer").mockResolvedValue([indexedWitness])
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe("Ethereum deposit finalization", () => {
	it.each(["pending", "canonical"] as const)(
		"accepts a %s indexed witness immediately after inner sync without a commit or timeout check",
		async (finalityStatus) => {
			const bridge = buildBridge()
			arrangeDeposit({
				bridge,
				syncedState: witness.afterActionState,
				syncedLength: UInt32.from(1),
				finalityStatus
			})

			await expect(bridge.canFinalizeEthereumDeposit(recipient)).resolves.toEqual({
				available: true,
				reason: null,
				index: 0
			})
		}
	)

	it("waits while the inner synchronized prefix does not cover the deposit", async () => {
		const bridge = buildBridge()
		arrangeDeposit({
			bridge,
			syncedState: witness.beforeActionState,
			syncedLength: UInt32.zero
		})

		await expect(bridge.canFinalizeEthereumDeposit(recipient)).resolves.toEqual({
			available: false,
			reason: "Deposit 0 is not synchronized into Zeko yet",
			index: 0
		})
	})

	it("ignores the Mina cancellation cursor because canonical Ethereum deposits cannot cancel", async () => {
		const bridge = buildBridge()
		arrangeDeposit({
			bridge,
			syncedState: witness.afterActionState,
			syncedLength: UInt32.from(1),
			minaCancelledCursor: 1
		})

		await expect(bridge.canFinalizeEthereumDeposit(recipient)).resolves.toEqual({
			available: true,
			reason: null,
			index: 0
		})
	})
})
