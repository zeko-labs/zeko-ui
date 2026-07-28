import { commitActions, innerActions, outerActions, witnessActions } from "@zeko/actions-api"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"
import { clearActionTables, clearInnerActionTables, clearOuterActionTables } from "../src/db"

const recordingDatabase = () => {
	const deleted: unknown[] = []
	const db = {
		delete: async (table: unknown) => {
			deleted.push(table)
		}
	} as unknown as PostgresJsDatabase
	return { db, deleted }
}

describe("action table clearing", () => {
	it("keeps outer and inner rebuild ownership disjoint", async () => {
		const outer = recordingDatabase()
		await clearOuterActionTables(outer.db)
		expect(outer.deleted).toEqual([witnessActions, commitActions, outerActions])
		expect(outer.deleted).not.toContain(innerActions)

		const inner = recordingDatabase()
		await clearInnerActionTables(inner.db)
		expect(inner.deleted).toEqual([innerActions])
		expect(inner.deleted).not.toContain(outerActions)
	})

	it("composes both stream clears for a full reset", async () => {
		const all = recordingDatabase()
		await clearActionTables(all.db)
		expect(all.deleted).toEqual([witnessActions, commitActions, outerActions, innerActions])
	})
})
