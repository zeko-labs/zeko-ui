import { and, between, desc, eq, gt, inArray, lt, sql } from "drizzle-orm"
import { actions, commitActions, witnessActions } from "../../drizzle/schema"
import { builder } from "../builder"
import type { Database } from "../db"

type BaseAction = {
	beforeState: string | null
	afterState: string
	length: number
	blockHeight: number
	slotRangeLower: number
	slotRangeUpper: number
	timestamp: Date
	createdAt: Date
	txnHash: string
	fields: string[]
	kind: "COMMIT" | "WITNESS"
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
		kind: "WITNESS"
	}))
}

// Works only if the db is linked list and not DAG, otherwise we need recursive CTE
export async function queryActions(
	db: DatabaseInstance,
	options: { beforeState: string; afterState?: string | null | undefined }
): Promise<Action[]> {
	const limitsCte = db.drizzle.$with("limits").as(
		db.drizzle
			.select({
				beforeLength: sql<number>`
					(
						select ${actions.length}
						from ${actions}
						where ${actions.beforeState} = ${options.beforeState}
						limit 1
					)
				`,
				afterLength: sql<number>`
					coalesce(
						(
							select ${actions.length}
							from ${actions}
							where ${actions.afterState} = ${options.afterState ?? null}
							limit 1
						),
						(
							select ${actions.length}
							from ${actions}
							order by ${actions.length} desc
							limit 1
						)
					)
				`
			})
			.from(actions)
			.limit(1)
	)

	const actionsResult = await db.drizzle
		.with(limitsCte)
		.select({
			action: actions,
			commit: commitActions,
			witness: witnessActions
		})
		.from(actions)
		.leftJoin(commitActions, eq(commitActions.afterState, actions.afterState))
		.leftJoin(witnessActions, eq(witnessActions.afterState, actions.afterState))
		.innerJoin(limitsCte, sql`true`)
		.where(between(actions.length, limitsCte.beforeLength, limitsCte.afterLength))
		.orderBy(actions.length)

	return actionsResult.map(({ action, commit, witness }) => {
		if (commit) {
			return {
				...action,
				...commit,
				kind: "COMMIT"
			}
		}
		if (witness) {
			return {
				...action,
				...witness,
				kind: "WITNESS"
			}
		}
		throw new Error("Invalid action")
	})
}

export async function queryCommitAsePastWithdrawalDelay(
	db: DatabaseInstance,
	slot: number
): Promise<{ commit: Commit | null; ase: Action[] }> {
	const lastCommitCte = db.drizzle.$with("last_commit").as(
		db.drizzle
			.select({
				lastAction: actions,
				lastCommit: commitActions,
				lastLength: actions.length
			})
			.from(actions)
			.innerJoin(commitActions, eq(actions.afterState, commitActions.afterState))
			.where(and(eq(actions.kind, "commit"), lt(actions.slotRangeUpper, slot)))
			.orderBy(desc(actions.length))
			.limit(1)
	)

	const result = await db.drizzle
		.with(lastCommitCte)
		.select({
			action: actions,
			commit: commitActions,
			witness: witnessActions,
			lastCommitAction: lastCommitCte.lastAction,
			lastCommit: lastCommitCte.lastCommit
		})
		.from(lastCommitCte)
		.leftJoin(actions, gt(actions.length, lastCommitCte.lastLength))
		.leftJoin(commitActions, eq(commitActions.afterState, actions.afterState))
		.leftJoin(witnessActions, eq(witnessActions.afterState, actions.afterState))
		.orderBy(actions.length)

	const lastCommit =
		result.length > 0
			? {
					action: result[0].lastCommitAction,
					commit: result[0].lastCommit
				}
			: null

	return {
		commit: lastCommit
			? {
					...lastCommit.commit,
					...lastCommit.action,
					kind: "COMMIT"
				}
			: null,
		ase: result
			.map(({ action, commit, witness }) => {
				if (!action) return null
				if (commit) {
					return {
						...action,
						...commit,
						kind: "COMMIT"
					}
				}
				if (witness) {
					return {
						...action,
						...witness,
						kind: "WITNESS"
					}
				}
				throw new Error("Invalid action")
			})
			.filter((action): action is Action => action !== null)
	}
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
		length: t.exposeInt("length"),
		blockHeight: t.exposeInt("blockHeight"),
		slotRangeLower: t.exposeInt("slotRangeLower"),
		slotRangeUpper: t.exposeInt("slotRangeUpper"),
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
