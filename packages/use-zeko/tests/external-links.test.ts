import { describe, expect, it } from "vitest"
import { externalLinkPattern } from "../src/validation/external-links.js"

describe("use-zeko external link extraction", () => {
	it("does not include trailing markdown backticks in extracted urls", () => {
		const inlineDocsUrl = "`https://docs.zeko.io`".match(externalLinkPattern)
		const inlineGraphQlUrl = "`https://testnet.zeko.io/graphql`".match(externalLinkPattern)

		expect(inlineDocsUrl).toEqual(["https://docs.zeko.io"])
		expect(inlineGraphQlUrl).toEqual(["https://testnet.zeko.io/graphql"])
	})
})
