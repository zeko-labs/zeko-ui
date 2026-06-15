import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(thisDir, "..")

describe("faucet container Dockerfile toolchain", () => {
	it("uses the pinned repository toolchain instead of floating Bun package-manager installs", () => {
		const dockerfile = fs.readFileSync(path.join(appRoot, "Dockerfile"), "utf8")

		expect(dockerfile).toContain("FROM node:24.5.0-bookworm-slim AS base")
		expect(dockerfile).not.toContain("FROM oven/bun:latest")
		expect(dockerfile).not.toContain("bun install -g pnpm")
		expect(dockerfile).toContain("COPY .prototools ./.prototools")
		expect(dockerfile).toContain("proto install --yes moon")
		expect(dockerfile).toContain("proto install --yes node")
		expect(dockerfile).toContain("proto install --yes pnpm")
		expect(dockerfile).toContain("moon docker scaffold faucet")
		expect(dockerfile).toContain("moon docker setup")
		expect(dockerfile).toContain("moon docker prune")
	})
})
