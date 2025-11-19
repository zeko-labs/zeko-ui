import { and, eq, inArray } from "drizzle-orm"
import { actions, witnessActions } from "../../drizzle/schema"
import { builder } from "../builder"
import type { Database } from "../db"

type Action = {
	beforeState: string
	afterState: string
	length: number
	blockHeight: number
	slotRangeLower: number
	slotRangeUpper: number
}

type Witness = Action & {
	aux: string
}

type WitnessesFromAuxesResult = {
	entries: Witness[]
}

type DatabaseInstance = ReturnType<Database>

export async function queryWitnessesFromAuxes(db: DatabaseInstance, auxes: string[]) {
	const witnesses = await db.drizzle
		.select()
		.from(witnessActions)
		.innerJoin(actions, eq(witnessActions.afterState, actions.afterState))
		.where(and(eq(actions.kind, "witness"), inArray(witnessActions.aux, auxes)))

	return witnesses.map(({ witness_actions, actions }) => ({
		...actions,
		aux: witness_actions.aux
	})) as Witness[]
}

/**
 * GraphQL Schema
 */
const WitnessObject = builder.objectRef<Witness>("Witness").implement({
	fields: (t) => ({
		beforeState: t.exposeString("beforeState", { nullable: false }),
		afterState: t.exposeString("afterState", { nullable: false }),
		length: t.exposeInt("length", { nullable: false }),
		blockHeight: t.exposeInt("blockHeight", { nullable: false }),
		slotRangeLower: t.exposeInt("slotRangeLower", { nullable: false }),
		slotRangeUpper: t.exposeInt("slotRangeUpper", { nullable: false }),
		aux: t.exposeString("aux", { nullable: false })
	})
})

const WitnessesFromAuxesResultObject = builder
	.objectRef<WitnessesFromAuxesResult>("WitnessesFromAuxesResult")
	.implement({
		fields: (t) => ({
			entries: t.field({
				type: [WitnessObject],
				resolve: (r) => r.entries,
				nullable: false
			})
		})
	})

const WitnessesFromAuxesInput = builder.inputType("WitnessesFromAuxesInput", {
	fields: (t) => ({
		auxes: t.stringList({ required: true })
	})
})

builder.queryType({
	fields: (t) => ({
		witnessesFromAuxes: t.field({
			type: WitnessesFromAuxesResultObject,
			args: { input: t.arg({ type: WitnessesFromAuxesInput, required: true }) },
			resolve: async (_root, { input }, { database }) => {
				using db = database({ cache: true })

				const result = await queryWitnessesFromAuxes(db, input.auxes)

				return { entries: result }
			}
		})
	})
})
