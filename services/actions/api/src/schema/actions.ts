import { and, between, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm"
import { actions, commitActions, witnessActions } from "../../drizzle/schema"
import { builder } from "../builder"
import type { Database } from "../db"

type BaseAction = {
	beforeState: string | null
	afterState: string
	index: number
	blockHeight: number
	slotRangeLower: string
	slotRangeUpper: string
	timestamp: string
	createdAt: Date
	txnHash: string
	fields: string[]
	kind: "COMMIT" | "WITNESS"
	markedAsCanonicalAt: Date | null
}

type Witness = BaseAction & {
	kind: "WITNESS"
	aux: string
}

type Commit = BaseAction & {
	kind: "COMMIT"
	ledger: string
	innerActionState: string
	innerActionStateLength: number
	synchronizedOuterActionState: string
	synchronizedOuterActionStateLength: number
}

type Action = Witness | Commit

type DatabaseInstance = ReturnType<Database>

export async function queryWitnessesFromAuxes(
	db: DatabaseInstance,
	auxes: string[]
): Promise<Witness[]> {
	const witnesses = await db.drizzle
		.select()
		.from(witnessActions)
		.innerJoin(actions, eq(witnessActions.afterState, actions.afterState))
		.where(and(eq(actions.kind, "witness"), inArray(witnessActions.aux, auxes)))

	return witnesses.map(({ witness_actions, actions }) => ({
		...actions,
		...witness_actions,
		kind: "WITNESS",
		slotRangeLower: actions.slotRangeLower.toString(),
		slotRangeUpper: actions.slotRangeUpper.toString(),
		timestamp: actions.timestamp.toISOString()
	}))
}

const GENESIS_BEFORE_STATE =
	"2965377540200775924504968637505084669999360240500907972788072774778139588064"
// Works only if the db is linked list and not DAG, otherwise we need recursive CTE
export async function queryActions(
	db: DatabaseInstance,
	options: { beforeState: string; afterState?: string | null | undefined }
): Promise<Action[]> {
	const beforeIndexQb = db.drizzle
		.select({ index: actions.index })
		.from(actions)
		.where(
			options.beforeState === GENESIS_BEFORE_STATE
				? isNull(actions.beforeState)
				: eq(actions.beforeState, options.beforeState)
		)
		.limit(1)

	const targetEndIndexQb = db.drizzle
		.select({ index: actions.index })
		.from(actions)
		.where(eq(actions.afterState, options.afterState ?? ""))
		.limit(1)

	const maxIndexQb = db.drizzle
		.select({ index: actions.index })
		.from(actions)
		.orderBy(desc(actions.index))
		.limit(1)

	const limitsCte = db.drizzle.$with("limits").as(
		db.drizzle
			.select({
				beforeIndex: sql<number>`(${beforeIndexQb})`.as("before_index"),
				afterIndex: sql<number>`coalesce((${targetEndIndexQb}), (${maxIndexQb}))`.as("after_index")
			})
			.from(actions)
			.limit(1)
	)

	const actionsResult = await db.drizzle
		.with(limitsCte)
		.select({ action: actions, commit: commitActions, witness: witnessActions })
		.from(actions)
		.crossJoin(limitsCte)
		.leftJoin(commitActions, eq(commitActions.afterState, actions.afterState))
		.leftJoin(witnessActions, eq(witnessActions.afterState, actions.afterState))
		.where(between(actions.index, limitsCte.beforeIndex, limitsCte.afterIndex))
		.orderBy(actions.index)

	return actionsResult.map(({ action, commit, witness }) => {
		if (commit) {
			return {
				...action,
				...commit,
				kind: "COMMIT",
				slotRangeLower: action.slotRangeLower.toString(),
				slotRangeUpper: action.slotRangeUpper.toString(),
				timestamp: action.timestamp.toISOString()
			}
		}
		if (witness) {
			return {
				...action,
				...witness,
				kind: "WITNESS",
				slotRangeLower: action.slotRangeLower.toString(),
				slotRangeUpper: action.slotRangeUpper.toString(),
				timestamp: action.timestamp.toISOString()
			}
		}
		throw new Error("Invalid action")
	})
}

export async function queryCommitAsePastWithdrawalDelay(
	db: DatabaseInstance,
	slot: number
): Promise<{ commit: Commit | null; ase: Action[] }> {
	// CTE: Find the index of the last commit before the given slot
	const lastCommitCte = db.drizzle.$with("last_commit_anchor").as(
		db.drizzle
			.select({ anchorIndex: actions.index })
			.from(actions)
			.innerJoin(commitActions, eq(actions.afterState, commitActions.afterState))
			.where(and(eq(actions.kind, "commit"), lt(actions.slotRangeUpper, BigInt(slot))))
			.orderBy(desc(actions.index))
			.limit(1)
	)

	// Fetch the last commit and all subsequent actions in one atomic query
	const rows = await db.drizzle
		.with(lastCommitCte)
		.select({ action: actions, commit: commitActions, witness: witnessActions })
		.from(actions)
		.crossJoin(lastCommitCte)
		.leftJoin(commitActions, eq(commitActions.afterState, actions.afterState))
		.leftJoin(witnessActions, eq(witnessActions.afterState, actions.afterState))
		.where(gte(actions.index, lastCommitCte.anchorIndex))
		.orderBy(actions.index)

	if (rows.length === 0) return { commit: null, ase: [] }

	const [lastCommit, ...aseRows] = rows

	if (!lastCommit.commit) {
		console.error(
			`Data Integrity Error: Anchor action ${lastCommit.action.index} is missing commit data`
		)
		return { commit: null, ase: [] }
	}

	const commit: Commit = {
		...lastCommit.action,
		...lastCommit.commit,
		kind: "COMMIT",
		slotRangeLower: lastCommit.action.slotRangeLower.toString(),
		slotRangeUpper: lastCommit.action.slotRangeUpper.toString(),
		timestamp: lastCommit.action.timestamp.toISOString()
	}

	const ase: Action[] = aseRows.map(({ action, commit, witness }) => {
		if (commit) {
			return {
				...action,
				...commit,
				kind: "COMMIT",
				slotRangeLower: action.slotRangeLower.toString(),
				slotRangeUpper: action.slotRangeUpper.toString(),
				timestamp: action.timestamp.toISOString()
			}
		}
		if (witness) {
			return {
				...action,
				...witness,
				kind: "WITNESS",
				slotRangeLower: action.slotRangeLower.toString(),
				slotRangeUpper: action.slotRangeUpper.toString(),
				timestamp: action.timestamp.toISOString()
			}
		}
		throw new Error(`Invalid action structure at index ${action.index}`)
	})
	return { commit, ase }
}

/**
 * GraphQL Schema
 */
const ActionKind = builder.enumType("ActionKind", {
	values: ["COMMIT", "WITNESS"] as const
})

const ActionInterface = builder.interfaceRef<BaseAction>("Action").implement({
	fields: (t) => ({
		afterState: t.exposeString("afterState"),
		beforeState: t.exposeString("beforeState", { nullable: true }),
		index: t.exposeInt("index"),
		blockHeight: t.exposeInt("blockHeight"),
		slotRangeLower: t.exposeString("slotRangeLower"),
		slotRangeUpper: t.exposeString("slotRangeUpper"),
		timestamp: t.exposeString("timestamp"),
		txnHash: t.exposeString("txnHash"),
		fields: t.exposeStringList("fields"),
		kind: t.field({ type: ActionKind, resolve: (r) => r.kind })
	})
})

const WitnessObject = builder.objectRef<Witness>("Witness").implement({
	interfaces: [ActionInterface],
	fields: (t) => ({
		aux: t.exposeString("aux")
	})
})

const CommitObject = builder.objectRef<Commit>("Commit").implement({
	interfaces: [ActionInterface],
	fields: (t) => ({
		ledger: t.exposeString("ledger"),
		innerActionState: t.exposeString("innerActionState"),
		innerActionStateLength: t.exposeInt("innerActionStateLength"),
		synchronizedOuterActionState: t.exposeString("synchronizedOuterActionState"),
		synchronizedOuterActionStateLength: t.exposeInt("synchronizedOuterActionStateLength")
	})
})

const ActionUnion = builder.unionType("ActionUnion", {
	types: [CommitObject, WitnessObject],
	resolveType: (value) => {
		switch (value.kind) {
			case "COMMIT":
				return CommitObject
			case "WITNESS":
				return WitnessObject
		}
	}
})

const WitnessesFromAuxesInput = builder.inputType("WitnessesFromAuxesInput", {
	fields: (t) => ({
		auxes: t.stringList({ required: true })
	})
})

const ActionsInput = builder.inputType("ActionsInput", {
	fields: (t) => ({
		beforeState: t.string({ required: true }),
		afterState: t.string({ required: false })
	})
})

const CommitAsePastWithdrawalDelayResult = builder
	.objectRef<{ commit: Commit | null; ase: Action[] }>("CommitAsePastWithdrawalDelayResult")
	.implement({
		fields: (t) => ({
			commit: t.field({ type: CommitObject, resolve: (r) => r.commit, nullable: true }),
			ase: t.field({ type: [ActionUnion], resolve: (r) => r.ase })
		})
	})

builder.queryType({
	fields: (t) => ({
		witnessesFromAuxes: t.field({
			type: [WitnessObject],
			args: { input: t.arg({ type: WitnessesFromAuxesInput, required: true }) },
			resolve: async (_root, { input }, { database }) => {
				using db = database({ cache: true })

				const result = await queryWitnessesFromAuxes(db, input.auxes)

				return result
			}
		}),
		actions: t.field({
			type: [ActionUnion],
			args: { input: t.arg({ type: ActionsInput, required: true }) },
			resolve: async (_root, { input }, { database }) => {
				using db = database({ cache: true })
				const result = await queryActions(db, input)
				return result
			}
		}),
		commitAsePastWithdrawalDelay: t.field({
			type: CommitAsePastWithdrawalDelayResult,
			args: { slot: t.arg({ type: "Int", required: true }) },
			resolve: async (_root, { slot }, { database }) => {
				using db = database({ cache: true })
				const result = await queryCommitAsePastWithdrawalDelay(db, slot)
				return result
			}
		})
	})
})
