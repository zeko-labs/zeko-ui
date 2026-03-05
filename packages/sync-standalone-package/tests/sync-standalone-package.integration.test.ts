import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { prepareStandalonePackage } from "../src/index"

const writeJson = (filePath: string, value: unknown) => {
	fs.mkdirSync(path.dirname(filePath), { recursive: true })
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

const writeText = (filePath: string, value: string) => {
	fs.mkdirSync(path.dirname(filePath), { recursive: true })
	fs.writeFileSync(filePath, value)
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

		writeJson(path.join(rootDir, "package.json"), {
			name: "workspace-root",
			packageManager: "pnpm@10.16.1"
		})

		writeText(
			path.join(rootDir, "pnpm-workspace.yaml"),
			`packages:
  - packages/**

catalog:
  "@scope/catalog-dep": ^1.4.0
  typescript: ^5.9.2

catalogs:
  tools:
    tsdown: ^0.13.4
`
		)

		writeText(path.join(rootDir, ".moon", "toolchains.yml"), "node:\n  version: 24.5.0\n")

		writeJson(path.join(rootDir, "packages", "shared", "package.json"), {
			name: "@scope/shared",
			version: "2.3.4"
		})

		writeJson(path.join(rootDir, "packages", "sync-target", "package.json"), {
			name: "@scope/sync-target",
			version: "1.0.0",
			dependencies: {
				"@scope/catalog-dep": "catalog:",
				"@scope/shared": "workspace:^"
			},
			devDependencies: {
				typescript: "catalog:",
				tsdown: "catalog:tools"
			}
		})

		writeJson(path.join(rootDir, "packages", "sync-target", "npm", "linux-x64", "package.json"), {
			name: "@scope/sync-target-linux-x64",
			version: "1.0.0",
			dependencies: {
				"@scope/sync-target": "workspace:^"
			}
		})

		writeText(
			path.join(rootDir, "packages", "sync-target", "moon.yml"),
			`layer: tool
dependsOn:
  - shared
tasks:
  build:
    command: echo build
`
		)

		prepareStandalonePackage({
			rootDir,
			packageDir: "packages/sync-target",
			projectId: "sync-target",
			workspacePackages: [".", "npm/*"],
			extraWorkspaceVersionSources: ["packages/shared/package.json"],
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
})
