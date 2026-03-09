import { fromList, pushHash } from "@zeko/bridge-sdk/actions"
import { createGraphqlClient } from "@zeko/bridge-sdk/graphql"
import { Field } from "o1js"
import { describe, expect, it } from "vitest"

describe("bridge-sdk subpath exports", () => {
	it("exports action helpers without loading the bridge root entrypoint", () => {
		const fields = [Field.from(1), Field.from(2)]
		const listHash = fromList([fields]).hash
		const nextHash = pushHash(Field.from(0), listHash)

		expect(listHash.toString()).not.toBe("")
		expect(nextHash.toString()).not.toBe("")
	})

	it("exports graphql client helpers", () => {
		const client = createGraphqlClient("https://example.com/graphql", "example")

		expect(client.label).toBe("example")
		expect(typeof client).toBe("function")
	})
})
