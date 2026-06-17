import { and, between, desc, eq, inArray, isNull, not, sql } from "drizzle-orm"
import { innerActions } from "../../drizzle/schema"
import { builder } from "../builder"
import type { Database } from "../db"
import { GENESIS_BEFORE_STATE } from "../helpers/utils"

type InnerAction = {
	beforeState: string | null
	afterState: string
	index: number
	blockHeight: number
	timestamp: string
	createdAt: Date
	txnHash: string
	fields: string[]
	aux: string
	markedAsCanonicalAt: Date | null
}

type DatabaseInstance = ReturnType<Database>

export async function queryInnerWitnessesFromAuxes(
	db: DatabaseInstance,
	auxes: string[]
): Promise<InnerAction[]> {
	if (auxes.length === 0) return []

	const witnesses = await db.drizzle
		.select()
		.from(innerActions)
		.where(and(inArray(innerActions.aux, auxes), not(isNull(innerActions.markedAsCanonicalAt))))

	return witnesses.map((action) => ({
		...action,
		timestamp: action.timestamp.toISOString()
	}))
}

// Works only if the db is linked list and not DAG, otherwise we need recursive CTE
export async function queryInnerActions(
	db: DatabaseInstance,
	options: { beforeState: string; afterState?: string | null | undefined }
): Promise<InnerAction[]> {
	const beforeIndexQb = db.drizzle
		.select({ index: innerActions.index })
		.from(innerActions)
		.where(
			and(
				options.beforeState === GENESIS_BEFORE_STATE
					? isNull(innerActions.beforeState)
					: eq(innerActions.beforeState, options.beforeState),
				not(isNull(innerActions.markedAsCanonicalAt))
			)
		)
		.limit(1)

	const targetEndIndexQb = db.drizzle
		.select({ index: innerActions.index })
		.from(innerActions)
		.where(
			and(
				eq(innerActions.afterState, options.afterState ?? ""),
				not(isNull(innerActions.markedAsCanonicalAt))
			)
		)
		.limit(1)

	const maxIndexQb = db.drizzle
		.select({ index: innerActions.index })
		.from(innerActions)
		.where(not(isNull(innerActions.markedAsCanonicalAt)))
		.orderBy(desc(innerActions.index))
		.limit(1)

	const limitsCte = db.drizzle.$with("limits").as(
		db.drizzle
			.select({
				beforeIndex: sql<number>`(${beforeIndexQb})`.as("before_index"),
				afterIndex: sql<number>`coalesce((${targetEndIndexQb}), (${maxIndexQb}))`.as("after_index")
			})
			.from(innerActions)
			.limit(1)
	)

	const actionsResult = await db.drizzle
		.with(limitsCte)
		.select({ action: innerActions })
		.from(innerActions)
		.crossJoin(limitsCte)
		.where(
			and(
				between(innerActions.index, limitsCte.beforeIndex, limitsCte.afterIndex),
				not(isNull(innerActions.markedAsCanonicalAt))
			)
		)
		.orderBy(innerActions.index)

	return actionsResult.map(({ action }) => {
		return {
			...action,
			timestamp: action.timestamp.toISOString()
		}
	})
}

/**
 * GraphQL Schema
 */

const InnerActionObject = builder.objectRef<InnerAction>("InnerAction").implement({
	fields: (t) => ({
		afterState: t.exposeString("afterState"),
		beforeState: t.exposeString("beforeState", { nullable: true }),
		index: t.exposeInt("index"),
		blockHeight: t.exposeInt("blockHeight"),
		timestamp: t.exposeString("timestamp"),
		txnHash: t.exposeString("txnHash"),
		fields: t.exposeStringList("fields"),
		aux: t.exposeString("aux"),
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

const InnerWitnessesFromAuxesInput = builder.inputType("InnerWitnessesFromAuxesInput", {
	fields: (t) => ({
		auxes: t.stringList({ required: true })
	})
})

const InnerActionsInput = builder.inputType("InnerActionsInput", {
	fields: (t) => ({
		beforeState: t.string({ required: true }),
		afterState: t.string({ required: false })
	})
})

builder.queryType({
	fields: (t) => ({
		innerWitnessesFromAuxes: t.field({
			type: [InnerActionObject],
			args: { input: t.arg({ type: InnerWitnessesFromAuxesInput, required: true }) },
			resolve: async (_root, { input }, { database }) => {
				using db = database({ cache: true })
				const result = await queryInnerWitnessesFromAuxes(db, input.auxes)
				return result
			}
		}),
		innerActions: t.field({
			type: [InnerActionObject],
			args: { input: t.arg({ type: InnerActionsInput, required: true }) },
			resolve: async (_root, { input }, { database }) => {
				using db = database({ cache: true })
				const result = await queryInnerActions(db, input)
				return result
			}
		})
	})
})
