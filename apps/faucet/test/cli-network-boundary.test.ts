import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(thisDir, "..")

describe("faucet network boundaries", () => {
	it("does not keep legacy Zeko network compatibility in the faucet management CLI", () => {
		const source = fs.readFileSync(path.join(appRoot, "scripts", "cli.ts"), "utf8")

		expect(source).not.toContain("normalizeLegacyNetworkId")
		expect(source).not.toContain("LEGACY")
		expect(source).not.toContain("zeko-testnet")
		expect(source).not.toContain("zeko-mainnet")
		expect(source).toContain("ZEKO_M_NETWORKS")
	})

	it("does not keep legacy Zeko network compatibility in the claim service", () => {
		const source = fs.readFileSync(path.join(appRoot, "worker", "claim-service.ts"), "utf8")

		expect(source).not.toContain("normalizeLegacyNetworkId")
		expect(source).not.toContain("LEGACY_NETWORK_ALIASES")
		expect(source).not.toContain("getLegacyAddressClaimKeys")
		expect(source).not.toContain("firstExistingClaim")
	})
})
