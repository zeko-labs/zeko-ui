import { afterEach, describe, expect, it, vi } from "vitest"
import { Field, PublicKey, UInt32, UInt64 } from "o1js"
import { Bridge } from "../src/index"
import type {
	Action,
	Config,
	Deposit,
	InnerWitness,
	OuterAction,
	OuterCommit,
	OuterWitness
} from "../src/types"
import { buildDepositDiagnostics, buildWithdrawalDiagnostics } from "../src/diagnostics"
import type { GqlClient } from "../src/graphql"
import {
	depositAux,
	fetchInnerWitnessesFromAuxes,
	fetchOuterWitnessesFromAuxes,
	withdrawalAux
} from "../src/utils"
import * as utils from "../src/utils"

const recipient = PublicKey.fromBase58("B62qpuhMDp748xtE77iBXRRaipJYgs6yumAeTzaM7zS9dn8avLPaeFF")
const holder = PublicKey.fromBase58("B62qmqHbTA6X54y5M2nSxpuPae5EUE2TBQXacAEqqgn667NRVFKDSeA")
const otherHolder = PublicKey.fromBase58("B62qpXxjsnR6XfV8KUGobiiYqiSjvHq59KKhXgvSXL61pSffKc8ggcb")
const outerPk = PublicKey.fromBase58("B62qkekmS9273D1EsFfMSJMMDAmgvh1WyoYE2vs1r7k4GtGBqVYABn2")
const otherOuterPk = PublicKey.fromBase58("B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1")

const bridgeConfig: Config = {
	l1Url: "http://l1.test",
	l1ArchiveUrl: "http://l1-archive.test",
	zekoUrl: "http://l2.test",
	zekoArchiveUrl: "http://l2-archive.test",
	l1Network: "testnet",
	l2Network: "testnet",
	actionsApi: "http://actions.test"
}

const buildGraphqlClient = (payload: { data?: unknown; error?: unknown }): GqlClient =>
	Object.assign(
		() =>
			({
				query: async () => payload
			}) as unknown as ReturnType<GqlClient>,
		{ label: "test-client" }
	)

const depositAction = (fields: Field[]): Action => ({
	action: fields,
	beforeActionState: Field(0),
	afterActionState: Field(1),
	hash: "deposit-hash",
	index: 0,
	timestamp: "1700000000000"
})

const withdrawalAction = (fields: Field[]): Action => ({
	action: fields,
	beforeActionState: Field(0),
	afterActionState: Field(2),
	hash: "withdrawal-hash",
	index: 0,
	timestamp: "1700000001000"
})

const buildBridge = () =>
	new Bridge(
		bridgeConfig,
		buildGraphqlClient({}),
		buildGraphqlClient({}),
		buildGraphqlClient({}),
		buildGraphqlClient({}),
		buildGraphqlClient({}),
		UInt64.from(1),
		UInt64.from(1),
		outerPk,
		otherOuterPk,
		[holder],
		holder,
		outerPk,
		otherOuterPk,
		UInt32.from(10)
	)

const buildDeposit = ({ amount, timeout }: { amount: number; timeout: number }): Deposit => ({
	recipient,
	amount: UInt64.from(amount),
	timeout: UInt32.from(timeout),
	holderAccountL1: holder
})

const buildDepositWitness = (
	deposit: Deposit,
	index: number,
	slotRange: { lower: number; upper: number }
): OuterWitness => ({
	action: [Field(index + 1), Field(index + 101)],
	afterActionState: Field(index + 201),
	beforeActionState: Field(index + 200),
	hash: `deposit-witness-${index}`,
	index,
	slotRange: {
		lower: UInt32.from(slotRange.lower),
		upper: UInt32.from(slotRange.upper)
	},
	timestamp: `${1700000000000 + index}`,
	type: "witness",
	aux: depositAux(deposit)
})

const buildOuterWitness = ({
	index,
	lower,
	upper,
	aux = Field(index + 500)
}: {
	index: number
	lower: number
	upper: number
	aux?: Field
}): OuterWitness => ({
	action: [Field(index + 301), Field(index + 401)],
	afterActionState: Field(index + 601),
	beforeActionState: Field(index + 600),
	hash: `outer-witness-${index}`,
	index,
	slotRange: {
		lower: UInt32.from(lower),
		upper: UInt32.from(upper)
	},
	timestamp: `${1700000001000 + index}`,
	type: "witness",
	aux
})

const buildCommit = ({
	index,
	lower,
	upper,
	synchronizedLength
}: {
	index: number
	lower: number
	upper: number
	synchronizedLength: number
}): OuterCommit => ({
	action: [Field(index + 701), Field(index + 801)],
	afterActionState: Field(index + 901),
	beforeActionState: Field(index + 900),
	hash: `commit-${index}`,
	index,
	slotRange: {
		lower: UInt32.from(lower),
		upper: UInt32.from(upper)
	},
	timestamp: `${1700000002000 + index}`,
	type: "commit",
	ledger: Field(index + 1001),
	innerActionState: Field(index + 1101),
	innerActionStateLength: UInt32.zero,
	synchronizedOuterActionState: Field(index + 1201),
	synchronizedOuterActionStateLength: UInt32.from(synchronizedLength)
})

const mockDepositState = ({
	bridge,
	deposits,
	depositWitnesses,
	outerActions,
	lastCommit,
	nextCancelledDeposit = 0,
	nextDeposit = 0,
	syncedLength = 0
}: {
	bridge: Bridge
	deposits: Deposit[]
	depositWitnesses: OuterWitness[]
	outerActions: OuterAction[]
	lastCommit: OuterCommit
	nextCancelledDeposit?: number
	nextDeposit?: number
	syncedLength?: number
}) => {
	const bridgeInternals = bridge as unknown as {
		fetchAccount: (...args: unknown[]) => Promise<{ zkappState: string[] | null } | null>
		fetchCurrentSlot: () => Promise<UInt32>
		fetchSyncedOuterActionState: () => Promise<{ state: Field; length: UInt32 }>
		fetchUserDeposits: (pk: PublicKey) => Promise<Deposit[]>
	}

	vi.spyOn(bridgeInternals, "fetchUserDeposits").mockResolvedValue(deposits)
	const fetchAccountSpy = vi.spyOn(bridgeInternals, "fetchAccount").mockResolvedValue(null)
	fetchAccountSpy
		.mockResolvedValueOnce({ zkappState: [String(nextCancelledDeposit)] })
		.mockResolvedValueOnce({ zkappState: [String(nextDeposit)] })
	vi.spyOn(bridgeInternals, "fetchSyncedOuterActionState").mockResolvedValue({
		state: Field(9_999),
		length: UInt32.from(syncedLength)
	})
	vi.spyOn(bridgeInternals, "fetchCurrentSlot").mockResolvedValue(UInt32.from(100))

	vi.spyOn(utils, "fetchOuterWitnessesFromAuxes").mockResolvedValue(depositWitnesses)
	vi.spyOn(utils, "fetchOuterActionsFromIndexer").mockResolvedValue(outerActions)
	vi.spyOn(utils, "fetchCommitAsePastSlot").mockResolvedValue({
		commit: lastCommit,
		ase: []
	})
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe("bridge diagnostics", () => {
	it("classifies deposits by filter and witness match status", () => {
		const matchedDeposit = depositAction([
			...recipient.toFields(),
			...UInt64.from(10).toFields(),
			...UInt32.from(5).toFields(),
			...holder.toFields(),
			...outerPk.toFields()
		])
		const missingWitnessDeposit = depositAction([
			...recipient.toFields(),
			...UInt64.from(11).toFields(),
			...UInt32.from(6).toFields(),
			...holder.toFields(),
			...outerPk.toFields()
		])
		const wrongOuterDeposit = depositAction([
			...recipient.toFields(),
			...UInt64.from(20).toFields(),
			...UInt32.from(9).toFields(),
			...holder.toFields(),
			...otherOuterPk.toFields()
		])
		const wrongHolderDeposit = depositAction([
			...recipient.toFields(),
			...UInt64.from(30).toFields(),
			...UInt32.from(10).toFields(),
			...otherHolder.toFields(),
			...outerPk.toFields()
		])
		const invalidDeposit = depositAction([Field(1), Field(2)])

		const matchedWitness: OuterWitness = {
			action: matchedDeposit.action,
			afterActionState: Field(11),
			beforeActionState: Field(10),
			hash: "witness-hash",
			index: 7,
			slotRange: { lower: UInt32.from(0), upper: UInt32.from(1) },
			timestamp: matchedDeposit.timestamp,
			type: "witness",
			aux: depositAux({
				recipient,
				amount: UInt64.from(10),
				timeout: UInt32.from(5),
				holderAccountL1: holder
			})
		}

		const diagnostics = buildDepositDiagnostics({
			actions: [
				matchedDeposit,
				missingWitnessDeposit,
				wrongOuterDeposit,
				wrongHolderDeposit,
				invalidDeposit
			],
			outerPk,
			outerHolders: [holder],
			witnesses: [matchedWitness]
		})

		expect(diagnostics.map((entry) => entry.status)).toEqual([
			"matched",
			"unmatched",
			"filtered",
			"filtered",
			"filtered"
		])
		expect(diagnostics.map((entry) => entry.reason)).toEqual([
			null,
			"missing-witness",
			"outer-pk-mismatch",
			"holder-account-mismatch",
			"invalid-action-shape"
		])
		expect(diagnostics[0].witness?.index).toBe(7)
	})

	it("classifies withdrawals by witness match status", () => {
		const matchedWithdrawal = withdrawalAction([
			...recipient.toFields(),
			...UInt64.from(15).toFields()
		])
		const invalidWithdrawal = withdrawalAction([Field(1)])
		const missingWitnessWithdrawal = withdrawalAction([
			...recipient.toFields(),
			...UInt64.from(18).toFields()
		])

		const matchedWitness: InnerWitness = {
			action: matchedWithdrawal.action,
			afterActionState: Field(21),
			beforeActionState: Field(20),
			hash: "withdrawal-witness-hash",
			index: 3,
			timestamp: matchedWithdrawal.timestamp,
			aux: withdrawalAux({
				recipient,
				amount: UInt64.from(15)
			})
		}

		const diagnostics = buildWithdrawalDiagnostics({
			actions: [matchedWithdrawal, invalidWithdrawal, missingWitnessWithdrawal],
			witnesses: [matchedWitness]
		})

		expect(diagnostics.map((entry) => entry.status)).toEqual(["matched", "filtered", "unmatched"])
		expect(diagnostics.map((entry) => entry.reason)).toEqual([
			null,
			"invalid-action-shape",
			"missing-witness"
		])
		expect(diagnostics[0].witness?.hash).toBe("withdrawal-witness-hash")
	})

	it("includes graphql errors and validation issues in witness fetch failures", async () => {
		const client = buildGraphqlClient({
			data: { outerWitnessesFromAuxes: [{ aux: 1 }] },
			error: new Error("GraphQL witness failure")
		})

		await expect(fetchOuterWitnessesFromAuxes(client, ["1"])).rejects.toThrow(
			/GraphQL witness failure/
		)
		await expect(fetchOuterWitnessesFromAuxes(client, ["1"])).rejects.toThrow(/Expected string/)
	})

	it("includes graphql errors and validation issues in inner witness fetch failures", async () => {
		const client = buildGraphqlClient({
			data: { innerWitnessesFromAuxes: [{ aux: 1 }] },
			error: new Error("GraphQL inner witness failure")
		})

		await expect(fetchInnerWitnessesFromAuxes(client, ["1"])).rejects.toThrow(
			/GraphQL inner witness failure/
		)
		await expect(fetchInnerWitnessesFromAuxes(client, ["1"])).rejects.toThrow(/Expected string/)
	})

	it("marks a rejected deposit as cancellable and keeps canCancelDeposit aligned", async () => {
		const bridge = buildBridge()
		const deposit = buildDeposit({ amount: 10, timeout: 5 })
		const depositWitness = buildDepositWitness(deposit, 0, { lower: 0, upper: 1 })
		const timeoutWitness = buildOuterWitness({ index: 1, lower: 6, upper: 6 })
		const lastCommit = buildCommit({ index: 2, lower: 7, upper: 7, synchronizedLength: 1 })

		mockDepositState({
			bridge,
			deposits: [deposit],
			depositWitnesses: [depositWitness],
			outerActions: [depositWitness, timeoutWitness, lastCommit],
			lastCommit,
			syncedLength: 1
		})

		const result = await bridge.fetchDepositsWithStates(recipient)

		expect(result.deposits).toHaveLength(1)
		expect(result.deposits[0]?.cancellable).toBe(true)
		expect(result.deposits[0]?.cancelled).toBe(false)
		expect(result.deposits[0]?.finalised).toBe(false)
		await expect(bridge.canCancelDeposit(recipient)).resolves.toBe(true)
	})

	it("marks multiple rejected deposits as cancellable", async () => {
		const bridge = buildBridge()
		const firstDeposit = buildDeposit({ amount: 10, timeout: 3 })
		const secondDeposit = buildDeposit({ amount: 12, timeout: 8 })
		const firstWitness = buildDepositWitness(firstDeposit, 0, { lower: 0, upper: 1 })
		const secondWitness = buildDepositWitness(secondDeposit, 1, { lower: 2, upper: 3 })
		const timeoutWitness = buildOuterWitness({ index: 2, lower: 10, upper: 10 })
		const lastCommit = buildCommit({ index: 3, lower: 12, upper: 12, synchronizedLength: 1 })

		mockDepositState({
			bridge,
			deposits: [firstDeposit, secondDeposit],
			depositWitnesses: [firstWitness, secondWitness],
			outerActions: [firstWitness, secondWitness, timeoutWitness, lastCommit],
			lastCommit,
			syncedLength: 1
		})

		const result = await bridge.fetchDepositsWithStates(recipient)

		expect(result.deposits.map((deposit) => deposit.cancellable)).toEqual([true, true])
		await expect(bridge.canCancelDeposit(recipient)).resolves.toBe(true)
	})

	it("keeps pending deposits non-cancellable", async () => {
		const bridge = buildBridge()
		const deposit = buildDeposit({ amount: 14, timeout: 10 })
		const depositWitness = buildDepositWitness(deposit, 1, { lower: 1, upper: 2 })
		const lastCommit = buildCommit({ index: 0, lower: 0, upper: 0, synchronizedLength: 0 })

		mockDepositState({
			bridge,
			deposits: [deposit],
			depositWitnesses: [depositWitness],
			outerActions: [lastCommit, depositWitness],
			lastCommit
		})

		const result = await bridge.fetchDepositsWithStates(recipient)

		expect(result.deposits[0]?.cancellable).toBe(false)
		await expect(bridge.canCancelDeposit(recipient)).resolves.toBe(false)
	})

	it("does not mark accepted deposits as cancellable", async () => {
		const bridge = buildBridge()
		const deposit = buildDeposit({ amount: 16, timeout: 5 })
		const depositWitness = buildDepositWitness(deposit, 0, { lower: 0, upper: 1 })
		const lastCommit = buildCommit({ index: 1, lower: 4, upper: 4, synchronizedLength: 1 })

		mockDepositState({
			bridge,
			deposits: [deposit],
			depositWitnesses: [depositWitness],
			outerActions: [depositWitness, lastCommit],
			lastCommit,
			syncedLength: 1
		})

		const result = await bridge.fetchDepositsWithStates(recipient)

		expect(result.deposits[0]?.accepted).toBe(true)
		expect(result.deposits[0]?.cancellable).toBe(false)
	})

	it("does not mark cancelled deposits as cancellable", async () => {
		const bridge = buildBridge()
		const deposit = buildDeposit({ amount: 18, timeout: 5 })
		const depositWitness = buildDepositWitness(deposit, 0, { lower: 0, upper: 1 })
		const timeoutWitness = buildOuterWitness({ index: 1, lower: 6, upper: 6 })
		const lastCommit = buildCommit({ index: 2, lower: 7, upper: 7, synchronizedLength: 1 })

		mockDepositState({
			bridge,
			deposits: [deposit],
			depositWitnesses: [depositWitness],
			outerActions: [depositWitness, timeoutWitness, lastCommit],
			lastCommit,
			nextCancelledDeposit: 1,
			syncedLength: 1
		})

		const result = await bridge.fetchDepositsWithStates(recipient)

		expect(result.deposits[0]?.cancelled).toBe(true)
		expect(result.deposits[0]?.cancellable).toBe(false)
	})

	it("does not mark finalised deposits as cancellable", async () => {
		const bridge = buildBridge()
		const deposit = buildDeposit({ amount: 20, timeout: 5 })
		const depositWitness = buildDepositWitness(deposit, 0, { lower: 0, upper: 1 })
		const timeoutWitness = buildOuterWitness({ index: 1, lower: 6, upper: 6 })
		const lastCommit = buildCommit({ index: 2, lower: 7, upper: 7, synchronizedLength: 1 })

		mockDepositState({
			bridge,
			deposits: [deposit],
			depositWitnesses: [depositWitness],
			outerActions: [depositWitness, timeoutWitness, lastCommit],
			lastCommit,
			nextDeposit: 1,
			syncedLength: 1
		})

		const result = await bridge.fetchDepositsWithStates(recipient)

		expect(result.deposits[0]?.finalised).toBe(true)
		expect(result.deposits[0]?.cancellable).toBe(false)
	})
})
