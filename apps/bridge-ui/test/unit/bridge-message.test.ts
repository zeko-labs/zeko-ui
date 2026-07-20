import { describe, expect, it } from "vitest"
import { createSSRApp, h } from "vue"
import { renderToString } from "vue/server-renderer"

import BridgeMessage from "../../app/components/BridgeMessage.vue"

describe("BridgeMessage", () => {
	it("does not render the obsolete transaction status link when a transaction URL exists", async () => {
		const html = await renderToString(
			createSSRApp({
				render: () =>
					h(BridgeMessage, {
						messageKey: "submitDeposit",
						transactionKey: "submitDeposit",
						transactions: {
							submitDeposit: {
								result: {
									hash: "5JsubmittedHash",
									url: "https://minascan.io/tx/5JsubmittedHash"
								}
							}
						}
					})
			})
		)

		expect(html).toContain("Waiting for the transaction to be confirmed.")
		expect(html).not.toContain("View transaction status on")
		expect(html).not.toContain("https://minascan.io/tx/5JsubmittedHash")
	})
})
