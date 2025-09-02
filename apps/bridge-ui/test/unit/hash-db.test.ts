import type { ZkappCommand } from "@aurowallet/mina-provider"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createDb, createExplorerUrl, hashDb } from "../../machines/helpers"

let db: ReturnType<typeof createDb>

const zkappCommand: ZkappCommand = {
	feePayer: { body: {} as unknown as ZkappCommand["feePayer"]["body"], authorization: "" },
	accountUpdates: [],
	memo: ""
}

const makeSettings = (n: number) => {
	const network = "zeko:testnet"
	const account = `B62qexample${n}`
	return { network, account, transaction: `test-${n}`, db } as const
}
describe("hashDb tests", () => {
	beforeAll(async () => {
		db = createDb()
	})
	afterAll(async () => {
		const tx = (await db).transaction("transactions", "readwrite")
		const index = tx.store.index("by-id")
		for await (const cursor of index.iterate()) {
			if (cursor.value.transaction.startsWith("test-")) cursor.delete()
		}
		await tx.done
	})

	it("saves an unconfirmed transaction and findUnconfirmed returns it", async () => {
		const db = hashDb(makeSettings(1))

		const hashValue = "HASH_ABC"
		await db.saveSigned({ hash: hashValue, confirmed: false, zkappCommand })
		const transaction = await db.findUnconfirmed()
		expect(transaction?.hash).toBe(hashValue)
		expect(transaction?.confirmed).toBe(false)
	})

	it("returns undefined when transaction is confirmed", async () => {
		const db = hashDb(makeSettings(2))

		const hash = "HASH_DEF"
		await db.saveSigned({ hash, confirmed: true, zkappCommand })
		const transaction = await db.findUnconfirmed()
		expect(transaction).toBeUndefined()
	})

	it("can store multiple ids and only unconfirmed ones are found", async () => {
		const txs = [
			{ hash: "H1", confirmed: false },
			{ hash: "H2", confirmed: true },
			{ hash: "H3", confirmed: false }
		]

		for (const { hash, confirmed } of txs) {
			const db = hashDb({ ...makeSettings(3) })
			await db.saveSigned({ hash, confirmed, zkappCommand })
			const tx = await db.findUnconfirmed()
			expect(tx?.hash).toBe(confirmed ? undefined : hash)
		}
	})

	it("createResult returns explorer url", async () => {
		const db = hashDb(makeSettings(4))
		const hash = "HX"
		await db.saveSigned({ hash, confirmed: false, zkappCommand })
		const res = db.createResult({ hash })
		expect(res.url).toBe(createExplorerUrl({ network: "zeko:testnet", hash }))
	})

	it("can update a transaction from unconfirmed to confirmed", async () => {
		const db = hashDb(makeSettings(5))
		await db.saveSigned({ hash: "HREP", confirmed: false, zkappCommand })
		const first = await db.findUnconfirmed()
		expect(first?.confirmed).toBe(false)

		await db.confirmTransaction()
		const second = await db.findUnconfirmed()
		expect(second).toBeUndefined()
	})
})
