import { and, between, desc, eq, inArray } from "drizzle-orm"
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
		kind: "WITNESS",
		aux: witness_actions.aux
	})) as Witness[]
}

// Works only if the db is linked list and not DAG, otherwise we need recursive CTE
export async function queryActions(
	db: DatabaseInstance,
	options: { beforeState: string; afterState?: string | null | undefined }
): Promise<Action[]> {
	const afterStateLength = options.afterState
		? (
				await db.drizzle
					.select()
					.from(actions)
					.where(eq(actions.afterState, options.afterState))
					.limit(1)
			)[0].length
		: (await db.drizzle.select().from(actions).orderBy(desc(actions.length)).limit(1))[0].length

	const beforeStateLength = (
		await db.drizzle
			.select()
			.from(actions)
			.where(eq(actions.beforeState, options.beforeState))
			.limit(1)
	)[0].length

	const actionsResult = await db.drizzle
		.select({
			action: actions,
			commit: commitActions,
			witness: witnessActions
		})
		.from(actions)
		.leftJoin(commitActions, eq(commitActions.afterState, actions.afterState))
		.leftJoin(witnessActions, eq(witnessActions.afterState, actions.afterState))
		.where(between(actions.length, beforeStateLength, afterStateLength))
		.orderBy(actions.length)

	return actionsResult.map(({ action, commit, witness }) => ({
		...commit,
		...witness,
		...action,
		kind: action.kind.toUpperCase() as "COMMIT" | "WITNESS"
	})) as Action[]
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
		})
	})
})
