import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { prepareStandalonePackage } from "../src/index"

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const fixtureRoot = path.join(thisDir, "fixtures", "workspace")

const materializeFixtureFiles = (rootDir: string) => {
	const stack = [rootDir]

	while (stack.length > 0) {
		const current = stack.pop()
		if (!current) {
			continue
		}

		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const source = path.join(current, entry.name)

			if (entry.isDirectory()) {
				stack.push(source)
				continue
			}

			if (!entry.isFile()) {
				continue
			}

			const target = source
				.replace(/\.fixture\.json$/, ".json")
				.replace(/\.fixture\.ya?ml$/, (match) => match.replace(".fixture", ""))

			if (target !== source) {
				fs.renameSync(source, target)
			}
		}
	}
}

describe("prepareStandalonePackage", () => {
	const tempDirs: string[] = []

	afterEach(() => {
		for (const dir of tempDirs) {
			fs.rmSync(dir, { recursive: true, force: true })
		}
		tempDirs.length = 0
	})

	it("rewrites package metadata and scaffolds standalone moon workspace", () => {
		const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-standalone-package-test-"))
		tempDirs.push(rootDir)
		fs.cpSync(fixtureRoot, rootDir, { recursive: true })
		materializeFixtureFiles(rootDir)

		prepareStandalonePackage({
			rootDir,
			packageDir: "packages/sync-target",
			projectId: "sync-target",
			projectPaths: [],
			workspacePackages: [".", "npm/*"],
			extraWorkspaceVersionSources: ["packages/shared/package.json"],
			preserveWorkspaceDependencies: [],
			pinDevCatalogVersions: true
		})

		const mainPackage = JSON.parse(
			fs.readFileSync(path.join(rootDir, "packages", "sync-target", "package.json"), "utf8")
		) as Record<string, unknown>

		expect(mainPackage.dependencies).toEqual({
			"@scope/catalog-dep": "^1.4.0",
			"@scope/shared": "^2.3.4"
		})
		expect(mainPackage.devDependencies).toEqual({
			typescript: "5.9.2",
			tsdown: "0.13.4"
		})
		expect(mainPackage.packageManager).toBe("pnpm@10.16.1")

		const nestedPackage = JSON.parse(
			fs.readFileSync(
				path.join(rootDir, "packages", "sync-target", "npm", "linux-x64", "package.json"),
				"utf8"
			)
		) as Record<string, unknown>

		expect(nestedPackage.dependencies).toEqual({
			"@scope/sync-target": "^1.0.0"
		})

		expect(
			fs.readFileSync(path.join(rootDir, "packages", "sync-target", "pnpm-workspace.yaml"), "utf8")
		).toBe("packages:\n  - .\n  - npm/*\n")

		expect(
			fs.readFileSync(
				path.join(rootDir, "packages", "sync-target", ".moon", "workspace.yml"),
				"utf8"
			)
		).toBe(
			`# yaml-language-server: $schema=./cache/schemas/workspace.json

projects:
  sync-target: "."
`
		)

		expect(
			fs.readFileSync(
				path.join(rootDir, "packages", "sync-target", ".moon", "toolchains.yml"),
				"utf8"
			)
		).toBe("node:\n  version: 24.5.0\n")

		expect(fs.readFileSync(path.join(rootDir, "packages", "sync-target", "moon.yml"), "utf8")).toBe(
			`layer: tool
tasks:
  build:
    command: echo build
`
		)
	})

	it("prepares a source monorepo mirror while preserving included workspace packages", () => {
		const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-source-monorepo-test-"))
		tempDirs.push(rootDir)
		fs.cpSync(fixtureRoot, rootDir, { recursive: true })
		materializeFixtureFiles(rootDir)

		prepareStandalonePackage({
			rootDir,
			packageDir: ".",
			projectId: "sync-target",
			projectPaths: ["sync-target=packages/sync-target", "shared=packages/shared"],
			workspacePackages: ["packages/*"],
			extraWorkspaceVersionSources: [],
			preserveWorkspaceDependencies: ["@scope/shared"],
			pinDevCatalogVersions: true
		})

		const mainPackage = JSON.parse(
			fs.readFileSync(path.join(rootDir, "packages", "sync-target", "package.json"), "utf8")
		) as Record<string, unknown>

		expect(mainPackage.dependencies).toEqual({
			"@scope/catalog-dep": "^1.4.0",
			"@scope/shared": "workspace:^"
		})
		expect(mainPackage.devDependencies).toEqual({
			typescript: "5.9.2",
			tsdown: "0.13.4"
		})

		expect(fs.readFileSync(path.join(rootDir, "pnpm-workspace.yaml"), "utf8")).toBe(
			"packages:\n  - packages/*\n"
		)
		expect(fs.readFileSync(path.join(rootDir, ".moon", "workspace.yml"), "utf8")).toBe(
			`# yaml-language-server: $schema=./cache/schemas/workspace.json

projects:
  sync-target: "packages/sync-target"
  shared: "packages/shared"
`
		)
	})

	it("assembles a source monorepo mirror from selected package paths", () => {
		const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-source-monorepo-input-test-"))
		const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-source-monorepo-output-test-"))
		tempDirs.push(rootDir, outputDir)
		fs.cpSync(fixtureRoot, rootDir, { recursive: true })
		materializeFixtureFiles(rootDir)

		prepareStandalonePackage({
			rootDir,
			packageDir: outputDir,
			projectId: "sync-target",
			sourcePackagePaths: ["packages/sync-target", "packages/shared"],
			projectPaths: ["sync-target=packages/sync-target", "shared=packages/shared"],
			workspacePackages: ["packages/*"],
			extraWorkspaceVersionSources: [],
			preserveWorkspaceDependencies: ["@scope/shared"],
			pinDevCatalogVersions: true
		})

		expect(fs.existsSync(path.join(outputDir, "packages", "sync-target", "package.json"))).toBe(
			true
		)
		expect(fs.existsSync(path.join(outputDir, "packages", "shared", "package.json"))).toBe(true)

		const rootPackage = JSON.parse(
			fs.readFileSync(path.join(outputDir, "package.json"), "utf8")
		) as Record<string, unknown>
		expect(rootPackage).toMatchObject({
			name: "@zeko-labs/sync-target-source",
			private: true,
			packageManager: "pnpm@10.16.1"
		})

		expect(fs.readFileSync(path.join(outputDir, "pnpm-workspace.yaml"), "utf8")).toBe(
			"packages:\n  - packages/*\n"
		)
		expect(fs.readFileSync(path.join(outputDir, ".moon", "workspace.yml"), "utf8")).toContain(
			'shared: "packages/shared"'
		)
	})
})
