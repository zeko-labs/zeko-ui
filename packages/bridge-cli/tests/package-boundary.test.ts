import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const packageRoot = path.resolve(__dirname, "..")
const repositoryRoot = path.resolve(packageRoot, "../..")

const readJson = (relativePath: string) =>
	JSON.parse(readFileSync(path.join(packageRoot, relativePath), "utf8")) as Record<string, unknown>

describe("published package boundary", () => {
	it("exports only the CLI entrypoint and package metadata", () => {
		const packageJson = readJson("package.json")

		expect(packageJson).toMatchObject({
			exports: {
				".": "./dist/cli.js",
				"./package.json": "./package.json"
			},
			files: ["dist/cli.js", "README.md", ".env.example"]
		})
		expect(packageJson).not.toHaveProperty("main")
		expect(packageJson).not.toHaveProperty("types")
	})

	it("builds only the CLI entrypoint", () => {
		const config = readFileSync(path.join(packageRoot, "tsdown.config.ts"), "utf8")

		expect(config).toContain('entry: ["./src/cli.ts"]')
		expect(config).toContain("inlineDynamicImports: true")
		expect(config).not.toContain("./src/index.ts")
		expect(existsSync(path.join(packageRoot, "src/index.ts"))).toBe(false)
	})

	it("keeps the CLI source as an entrypoint instead of a reusable API", () => {
		const cliSource = readFileSync(path.join(packageRoot, "src/cli.ts"), "utf8")

		expect(cliSource).not.toMatch(/export\s+const\s+createBridgeCli/)
		expect(cliSource).not.toContain("shouldRunBridgeCli")
		expect(cliSource).toContain("await loadBridgeCliEnv()")
		expect(cliSource).toContain("await runMain(createBridgeCliCommand())")
		expect(existsSync(path.join(packageRoot, "src/core/entrypoint.ts"))).toBe(false)
	})

	it("syncs the CLI source and internal network package source to the public mirror", () => {
		const workflow = readFileSync(
			path.join(repositoryRoot, ".github", "workflows", "sync-bridge-cli.yaml"),
			"utf8"
		)
		const packageJson = readJson("package.json")

		expect(packageJson.devDependencies).toMatchObject({
			"@zeko/networks": "workspace:*"
		})
		expect(packageJson.dependencies).not.toHaveProperty("@zeko/networks")
		expect(workflow).toContain("packages/bridge-cli")
		expect(workflow).toContain("packages/networks")
		expect(workflow).toContain("packages/*")
		expect(workflow).not.toContain("sync-paths")
		expect(workflow).not.toContain("bridge-cli:build")
	})
})
