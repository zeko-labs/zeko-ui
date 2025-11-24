import { Field, Poseidon, PublicKey, UInt32, fetchAccount, type Mina } from "o1js"
import type { Client } from "urql"
import * as v from "valibot"
import {
	fetchActionsQueryIndexer,
	fetchCommitAsePastWithdrawalDelayQuery,
	fetchWitnessesFromAuxesQuery
} from "../../graphql/src/bridge-indexer"
import { fetchActionsQuery, networkStateQuery } from "../../graphql/src/mina-archive"
import { empty, fromList, pushHash } from "./actions"
import type {
	Account,
	Action,
	Deposit,
	OuterAction,
	OuterCommit,
	OuterWitness,
	Withdrawal
} from "./types"

const BaseActionSchema = v.object({
	afterState: v.string(),
	beforeState: v.nullable(v.string()),
	index: v.number(),
	blockHeight: v.number(),
	slotRangeLower: v.string(),
	slotRangeUpper: v.string(),
	timestamp: v.string(),
	txnHash: v.string(),
	fields: v.array(v.string()),
	kind: v.string()
})

const baseActionFromSchema = (x: v.InferOutput<typeof BaseActionSchema>) => ({
	beforeActionState: Field.from(x.beforeState ?? empty().hash),
	afterActionState: Field.from(x.afterState),
	timestamp: x.timestamp,
	hash: x.txnHash,
	index: x.index,
	action: x.fields.map(Field.from),
	slotRange: {
		lower: UInt32.from(x.slotRangeLower),
		upper: UInt32.from(x.slotRangeUpper)
	}
})

const CommitSchema = v.object({
	...BaseActionSchema.entries,
	kind: v.literal("COMMIT"),
	ledger: v.string(),
	innerActionState: v.string(),
	innerActionStateLength: v.number(),
	synchronizedOuterActionState: v.string(),
	synchronizedOuterActionStateLength: v.number()
})

const commitFromSchema = (x: v.InferOutput<typeof CommitSchema>) => ({
	ledger: Field.from(x.ledger),
	innerActionState: Field.from(x.innerActionState),
	innerActionStateLength: UInt32.from(x.innerActionStateLength),
	synchronizedOuterActionState: Field.from(x.synchronizedOuterActionState),
	synchronizedOuterActionStateLength: UInt32.from(x.synchronizedOuterActionStateLength)
})

const WitnessSchema = v.object({
	...BaseActionSchema.entries,
	kind: v.literal("WITNESS"),
	aux: v.string()
})

const witnessFromSchema = (x: v.InferOutput<typeof WitnessSchema>) => ({
	aux: Field.from(x.aux)
})

const ActionSchema = v.variant("kind", [CommitSchema, WitnessSchema])

export async function fetchActionsFromIndexer(
	client: Client,
	options: { fromState: string; afterState?: string | null | undefined }
): Promise<OuterAction[]> {
	const { data, error } = await client.query(fetchActionsQueryIndexer, {
		beforeState: options.fromState,
		afterState: options.afterState
	})

	const result = v.safeParse(v.array(ActionSchema), data?.actions)
	if (!result.success) {
		console.error(error)
		console.error(result.issues)
		throw new Error("Invalid actions data")
	}

	return result.output.map((action) => ({
		...baseActionFromSchema(action),
		...(action.kind === "COMMIT"
			? { ...commitFromSchema(action), type: "commit" }
			: { ...witnessFromSchema(action), type: "witness" })
	}))
}

export async function fetchWitnessesFromAuxes(
	client: Client,
	auxes: string[]
): Promise<OuterWitness[]> {
	const { data, error } = await client.query(fetchWitnessesFromAuxesQuery, { auxes })

	const result = v.safeParse(v.array(WitnessSchema), data?.witnessesFromAuxes)
	if (!result.success) {
		console.error(error)
		console.error(result.issues)
		throw new Error("Invalid witnesses data")
	}

	return result.output.map((witness) => ({
		...baseActionFromSchema(witness),
		...witnessFromSchema(witness),
		type: "witness"
	}))
}

export async function fetchCommitAsePastWithdrawalDelay(
	client: Client,
	slot: number
): Promise<{ commit: OuterCommit; ase: OuterAction[] }> {
	const { data, error } = await client.query(fetchCommitAsePastWithdrawalDelayQuery, { slot })

	const result = v.safeParse(
		v.object({ commit: CommitSchema, ase: v.array(ActionSchema) }),
		data?.commitAsePastWithdrawalDelay
	)
	if (!result.success) {
		console.error(error)
		console.error(result.issues)
		throw new Error("Invalid commit ase past withdrawal delay data")
	}

	return {
		commit: {
			...baseActionFromSchema(result.output.commit),
			...commitFromSchema(result.output.commit),
			type: "commit"
		},
		ase: result.output.ase.map((action) => ({
			...baseActionFromSchema(action),
			...(action.kind === "COMMIT"
				? { ...commitFromSchema(action), type: "commit" }
				: { ...witnessFromSchema(action), type: "witness" })
		}))
	}
}

// The graphQL schema server will limit the block scan range to a fixed number of blocks.
// https://github.com/o1-labs/Archive-Node-API/blob/2d726955502fbd02c70d388f589284dd838bbb45/src/server/server.ts#L13
const BLOCK_RANGE_SIZE = 10_000

export const BRIDGE_DEPLOY_BLOCK = 430_000

export async function getNetworkTip(client: Client): Promise<number> {
	const res = await client.query(networkStateQuery, {})
	if (res.error) throw res.error
	const height = res.data?.networkState?.maxBlockHeight?.pendingMaxBlockHeight ?? 0
	return height
}

export async function fetchActions(
	client: Client,
	pk: PublicKey,

	stopAtBlock = 0
): Promise<Action[]> {
	const networkTip = await getNetworkTip(client)

	const fetchActionsRecursive = async (toBlock: number) => {
		if (toBlock < stopAtBlock) return []

		const { data } = await client.query(fetchActionsQuery, {
			pk: pk.toBase58(),
			from: toBlock - BLOCK_RANGE_SIZE,
			to: toBlock
		})
		const dataWithDefault = data?.actions.map((a) => ({
			...a,
			actionData: a?.actionData?.map((ad) => ({
				...ad,
				transactionInfo: ad?.transactionInfo ?? { status: "status", hash: "hash" }
			})),
			blockInfo: {
				timestamp: String(a?.blockInfo?.timestamp ?? "0"),
				height: Number(a?.blockInfo?.height ?? 0)
			}
		}))

		const schema = v.array(
			v.object({
				blockInfo: v.object({ timestamp: v.string(), height: v.number() }),
				actionState: v.object({
					actionStateOne: v.string(),
					actionStateTwo: v.string()
				}),
				actionData: v.array(
					v.object({
						data: v.array(v.string()),
						transactionInfo: v.object({ hash: v.string() })
					})
				)
			})
		)

		const result = v.safeParse(schema, dataWithDefault)
		if (!result.success) throw new Error("Invalid actions data")

		const prevOutput: v.InferOutput<typeof schema> = await fetchActionsRecursive(
			toBlock - BLOCK_RANGE_SIZE
		)
		return [...prevOutput, ...result.output]
	}

	const output = await fetchActionsRecursive(networkTip)

	return output.flatMap(
		(
			{ actionState: { actionStateTwo: actionStateBefore }, actionData, blockInfo: { timestamp } },
			index
		) => {
			const actions = actionData.map(({ data, transactionInfo: { hash } }) => ({
				data: data.map(Field.from),
				hash
			}))
			let actionState = Field.from(actionStateBefore)

			const correctActions = []
			for (let i = 0; i < actions.length; i++) {
				const action = actions[i]
				const afterActionState = pushHash(actionState, fromList([action.data]).hash)
				correctActions.push({
					index: index + i,
					action: action.data,
					beforeActionState: actionState,
					afterActionState,
					timestamp,
					hash: action.hash
				})
				actionState = afterActionState
			}

			return correctActions
		}
	)
}

export function depositAux(deposit: Deposit): Field {
	return Poseidon.hashWithPrefix("Deposit_params - qFB3jXP*)", [
		Field(0), // Empty children
		...deposit.holderAccountL1.toFields(),
		...deposit.amount.toFields(),
		...deposit.recipient.toFields(),
		...deposit.timeout.toFields()
	])
}

export function withdrawalAux(withdrawal: Withdrawal): Field {
	return Poseidon.hashWithPrefix("Withdrawal_params - qFB3jXP*)", [
		Field(0), // Empty children
		...withdrawal.amount.toFields(),
		...withdrawal.recipient.toFields()
	])
}

export function getNextDepositIndex(helperAccount: Account): UInt32 {
	const nextDepositIndex = helperAccount.zkappState?.at(0)
	return UInt32.from(nextDepositIndex ?? 0)
}

export function getNextWithdrawalIndex(helperAccount: Account): UInt32 {
	const nextWithdrawalIndex = helperAccount.zkappState?.at(1)
	return UInt32.from(nextWithdrawalIndex ?? 0)
}

export function filterNulls<T>(arr: (T | null)[]): T[] {
	return arr.filter(Boolean).map((x) => {
		if (x === null) throw new Error("Unreachable")
		return x
	})
}

export async function refreshCache(feePayer: Mina.FeePayerSpec) {
	if (feePayer instanceof PublicKey) {
		await fetchAccount({ publicKey: feePayer })
	} else if (feePayer) {
		await fetchAccount({
			publicKey: feePayer.sender
		})
	}
}
