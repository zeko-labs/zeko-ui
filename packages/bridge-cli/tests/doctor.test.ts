import { describe, expect, it } from "vitest"
import { createDoctorCommand } from "../src/commands/doctor"
import type { AppPaths } from "../src/core/paths"

const appPaths: AppPaths = {
	dataDir: "/tmp/data",
	stateDir: "/tmp/state",
	logDir: "/tmp/logs",
	cacheDir: "/tmp/cache"
}

describe("doctor command", () => {
	it("reports configured paths, keys, and known routes", async () => {
		const writes: string[] = []
		const command = createDoctorCommand({
			resolvePaths: () => appPaths,
			resolveKeys: () => ({
				mina: "mina-private-key",
				zeko: "zeko-private-key",
				eth: undefined
			}),
			fetch: (async () => new Response("ok", { status: 200, statusText: "OK" })) as typeof fetch,
			write: (message) => writes.push(message)
		})

		await command.run?.({ rawArgs: [], args: { _: [] }, cmd: command })

		expect(writes[0]).toContain("bridge doctor")
		expect(writes[0]).toContain("Data dir: /tmp/data")
		expect(writes[0]).toContain("Wallet private key: configured")
		expect(writes[0]).toContain("Route status:")
		expect(writes[0]).toContain("mina:testnet->zeko:testnet: enabled")
		expect(writes[0]).toContain("mina:mainnet->zeko:mainnet: enabled")
		expect(writes[0]).toContain(
			"actionsApi=https://testnet.api.actions.zeko.io/graphql; l1=testnet; l2=testnet"
		)
		expect(writes[0]).toContain(
			"actionsApi=https://api.actions.zeko.io/graphql; l1=mainnet; l2=mainnet"
		)
		expect(writes[0]).toContain("https://testnet.api.actions.zeko.io/health -> 200 OK")
		expect(writes[0]).toContain("https://api.actions.zeko.io/health -> 200 OK")
	})
})
