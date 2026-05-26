import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8")) as {
	dependencies: Record<string, string>
}
const dockerfile = readFileSync(resolve(projectRoot, "Dockerfile"), "utf8")

describe("bridge-validator sandbox runtime", () => {
	it("pins the Cloudflare Sandbox SDK and container image to the same version", () => {
		const sandboxVersion = packageJson.dependencies["@cloudflare/sandbox"]

		expect(sandboxVersion).toMatch(/^\d+\.\d+\.\d+$/)
		expect(dockerfile).toContain(`FROM docker.io/cloudflare/sandbox:${sandboxVersion}`)
	})
})
