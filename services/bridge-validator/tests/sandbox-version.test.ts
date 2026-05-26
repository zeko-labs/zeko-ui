import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8")) as {
	dependencies: Record<string, string>
	bridgeCli: {
		package: string
		version: string
	}
}
const dockerfile = readFileSync(resolve(projectRoot, "Dockerfile"), "utf8")
const wranglerConfig = readFileSync(resolve(projectRoot, "wrangler.jsonc"), "utf8")

describe("bridge-validator sandbox runtime", () => {
	it("pins the Cloudflare Sandbox SDK and container image to the same version", () => {
		const sandboxVersion = packageJson.dependencies["@cloudflare/sandbox"]

		expect(sandboxVersion).toMatch(/^\d+\.\d+\.\d+$/)
		expect(dockerfile).toContain(`FROM docker.io/cloudflare/sandbox:${sandboxVersion}`)
	})

	it("installs the bridge CLI version configured in package.json", () => {
		expect(packageJson.bridgeCli).toEqual({
			package: "@zeko-labs/bridge-cli",
			version: "latest"
		})
		expect(dockerfile).toContain("bridgeCli.package")
		expect(dockerfile).toContain("bridgeCli.version")
		expect(dockerfile).toContain("p.bridgeCli.package + '@' + p.bridgeCli.version")
		expect(dockerfile).not.toContain("@zeko-labs/bridge-cli@latest")
		expect(dockerfile).not.toContain("`${p.bridgeCli.package}@${p.bridgeCli.version}`")
	})

	it("uses a sandbox size that can run the published bridge CLI", () => {
		expect(wranglerConfig).toContain('"instance_type": "standard-2"')
		expect(wranglerConfig).not.toContain('"instance_type": "standard-1"')
		expect(wranglerConfig).not.toContain('"instance_type": "lite"')
	})
})
