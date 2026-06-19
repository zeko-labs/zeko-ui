import { and, between, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm"
import { commitActions, outerActions, witnessActions } from "../../drizzle/schema"
import { builder } from "../builder"
import type { Database } from "../db"
import { GENESIS_BEFORE_STATE } from "../helpers/utils"

type OuterBaseAction = {
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

type Witness = OuterBaseAction & {
	kind: "WITNESS"
	aux: string
}

type Commit = OuterBaseAction & {
	kind: "COMMIT"
	ledger: string
	innerActionState: string
	innerActionStateLength: number
	synchronizedOuterActionState: string
	synchronizedOuterActionStateLength: number
}

type OuterAction = Witness | Commit

type DatabaseInstance = ReturnType<Database>

export async function queryOuterWitnessesFromAuxes(
	db: DatabaseInstance,
	auxes: string[]
): Promise<Witness[]> {
	if (auxes.length === 0) return []

	const witnesses = await db.drizzle
		.select()
		.from(witnessActions)
		.innerJoin(outerActions, eq(witnessActions.afterState, outerActions.afterState))
		.where(and(eq(outerActions.kind, "witness"), inArray(witnessActions.aux, auxes)))
		.orderBy(outerActions.index)

	return witnesses.map(({ witness_actions, outer_actions }) => ({
		...outer_actions,
		...witness_actions,
		kind: "WITNESS",
		slotRangeLower: outer_actions.slotRangeLower.toString(),
		slotRangeUpper: outer_actions.slotRangeUpper.toString(),
		timestamp: outer_actions.timestamp.toISOString()
	}))
}

// Works only if the db is linked list and not DAG, otherwise we need recursive CTE
export async function queryOuterActions(
	db: DatabaseInstance,
	options: { beforeState: string; afterState?: string | null | undefined }
): Promise<OuterAction[]> {
	const beforeIndexQb = db.drizzle
		.select({ index: outerActions.index })
		.from(outerActions)
		.where(
			options.beforeState === GENESIS_BEFORE_STATE
				? isNull(outerActions.beforeState)
				: eq(outerActions.beforeState, options.beforeState)
		)
		.limit(1)

	const targetEndIndexQb = db.drizzle
		.select({ index: outerActions.index })
		.from(outerActions)
		.where(eq(outerActions.afterState, options.afterState ?? ""))
		.limit(1)

	const maxIndexQb = db.drizzle
		.select({ index: outerActions.index })
		.from(outerActions)
		.orderBy(desc(outerActions.index))
		.limit(1)

	const limitsCte = db.drizzle.$with("limits").as(
		db.drizzle
			.select({
				beforeIndex: sql<number>`(${beforeIndexQb})`.as("before_index"),
				afterIndex: sql<number>`coalesce((${targetEndIndexQb}), (${maxIndexQb}))`.as("after_index")
			})
			.from(outerActions)
			.limit(1)
	)

	const actionsResult = await db.drizzle
		.with(limitsCte)
		.select({ action: outerActions, commit: commitActions, witness: witnessActions })
		.from(outerActions)
		.crossJoin(limitsCte)
		.leftJoin(commitActions, eq(commitActions.afterState, outerActions.afterState))
		.leftJoin(witnessActions, eq(witnessActions.afterState, outerActions.afterState))
		.where(between(outerActions.index, limitsCte.beforeIndex, limitsCte.afterIndex))
		.orderBy(outerActions.index)

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

export async function queryCommitAsePastSlot(
	db: DatabaseInstance,
	slot: number
): Promise<{ commit: Commit | null; ase: OuterAction[] }> {
	// CTE: Find the index of the last commit before the given slot
	const lastCommitCte = db.drizzle.$with("last_commit_anchor").as(
		db.drizzle
			.select({ anchorIndex: outerActions.index })
			.from(outerActions)
			.innerJoin(commitActions, eq(outerActions.afterState, commitActions.afterState))
			.where(and(eq(outerActions.kind, "commit"), lt(outerActions.slotRangeUpper, BigInt(slot))))
			.orderBy(desc(outerActions.index))
			.limit(1)
	)

	// Fetch the last commit and all subsequent actions in one atomic query
	const rows = await db.drizzle
		.with(lastCommitCte)
		.select({ action: outerActions, commit: commitActions, witness: witnessActions })
		.from(outerActions)
		.crossJoin(lastCommitCte)
		.leftJoin(commitActions, eq(commitActions.afterState, outerActions.afterState))
		.leftJoin(witnessActions, eq(witnessActions.afterState, outerActions.afterState))
		.where(gte(outerActions.index, lastCommitCte.anchorIndex))
		.orderBy(outerActions.index)

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

	const ase: OuterAction[] = aseRows.map(({ action, commit, witness }) => {
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
const OuterActionKind = builder.enumType("OuterActionKind", {
	values: ["COMMIT", "WITNESS"] as const
})

const OuterActionInterface = builder.interfaceRef<OuterBaseAction>("OuterAction").implement({
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
		kind: t.field({ type: OuterActionKind, resolve: (r) => r.kind }),
		markedAsCanonicalAt: t.field({
			type: "String",
			nullable: true,
			resolve: (r) => r.markedAsCanonicalAt?.toISOString() ?? null
		}),
		finalityStatus: t.field({
			type: "String",
			resolve: (r) => (r.markedAsCanonicalAt === null ? "pending_finality" : "final")
		})
	})
})

const WitnessObject = builder.objectRef<Witness>("Witness").implement({
	interfaces: [OuterActionInterface],
	fields: (t) => ({
		aux: t.exposeString("aux")
	})
})

const CommitObject = builder.objectRef<Commit>("Commit").implement({
	interfaces: [OuterActionInterface],
	fields: (t) => ({
		ledger: t.exposeString("ledger"),
		innerActionState: t.exposeString("innerActionState"),
		innerActionStateLength: t.exposeInt("innerActionStateLength"),
		synchronizedOuterActionState: t.exposeString("synchronizedOuterActionState"),
		synchronizedOuterActionStateLength: t.exposeInt("synchronizedOuterActionStateLength")
	})
})

const OuterActionUnion = builder.unionType("OuterActionUnion", {
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

const OuterWitnessesFromAuxesInput = builder.inputType("OuterWitnessesFromAuxesInput", {
	fields: (t) => ({
		auxes: t.stringList({ required: true })
	})
})

const OuterActionsInput = builder.inputType("OuterActionsInput", {
	fields: (t) => ({
		beforeState: t.string({ required: true }),
		afterState: t.string({ required: false })
	})
})

const CommitAsePastSlotResult = builder
	.objectRef<{ commit: Commit | null; ase: OuterAction[] }>("CommitAsePastSlotResult")
	.implement({
		fields: (t) => ({
			commit: t.field({ type: CommitObject, resolve: (r) => r.commit, nullable: true }),
			ase: t.field({ type: [OuterActionUnion], resolve: (r) => r.ase })
		})
	})

builder.queryType({
	fields: (t) => ({
		outerWitnessesFromAuxes: t.field({
			type: [WitnessObject],
			args: { input: t.arg({ type: OuterWitnessesFromAuxesInput, required: true }) },
			resolve: async (_root, { input }, { database }) => {
				using db = database({ cache: true })
				const result = await queryOuterWitnessesFromAuxes(db, input.auxes)
				return result
			}
		}),
		outerActions: t.field({
			type: [OuterActionUnion],
			args: { input: t.arg({ type: OuterActionsInput, required: true }) },
			resolve: async (_root, { input }, { database }) => {
				using db = database({ cache: true })
				const result = await queryOuterActions(db, input)
				return result
			}
		}),
		commitAsePastSlot: t.field({
			type: CommitAsePastSlotResult,
			args: { slot: t.arg({ type: "Int", required: true }) },
			resolve: async (_root, { slot }, { database }) => {
				using db = database({ cache: true })
				const result = await queryCommitAsePastSlot(db, slot)
				return result
			}
		})
	})
})
