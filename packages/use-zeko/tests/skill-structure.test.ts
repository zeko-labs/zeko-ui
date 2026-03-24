import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(thisDir, "..")
const skillRoot = path.join(packageRoot, "zeko")
const skillPath = path.join(skillRoot, "SKILL.md")
const referencesDir = path.join(skillRoot, "references")
const requiredReferences = [
	"10-navigation.md",
	"10-agent-workflows.md",
	"20-user-flows.md",
	"30-bridge-and-faucet.md",
	"40-endpoints-and-curl.md",
	"50-build-on-zeko.md",
	"60-sequencer-archive-and-da.md"
]

describe("use-zeko skill structure", () => {
	it("ships the router skill and every required reference file", () => {
		expect(fs.existsSync(skillRoot)).toBe(true)
		expect(fs.existsSync(skillPath)).toBe(true)
		expect(fs.existsSync(referencesDir)).toBe(true)

		for (const referenceFile of requiredReferences) {
			expect(fs.existsSync(path.join(referencesDir, referenceFile))).toBe(true)
		}
	})

	it("links every required reference directly from the root skill", () => {
		const skill = fs.readFileSync(skillPath, "utf8")

		for (const referenceFile of requiredReferences) {
			expect(skill).toContain(`references/${referenceFile}`)
		}

		expect(skill).toContain("docs.zeko.io")
		expect(skill).not.toContain("references/copied/")
		expect(skill).not.toContain("llms-full.txt")
	})

	it("keeps shipped markdown self-contained to the skill directory and rich enough for agents", () => {
		const markdownFiles = [
			skillPath,
			path.join(packageRoot, "README.md"),
			...requiredReferences.map((referenceFile) => path.join(referencesDir, referenceFile))
		]

		for (const markdownFile of markdownFiles) {
			const content = fs.readFileSync(markdownFile, "utf8")
			expect(content).not.toMatch(/\b(?:apps|packages|services|docs)\/[^\s)`]+/)
			expect(content).not.toContain("../")
			expect(content).not.toContain("/Users/")
		}

		const endpointsAndCurl = fs.readFileSync(
			path.join(referencesDir, "40-endpoints-and-curl.md"),
			"utf8"
		)
		expect(endpointsAndCurl).toContain("curl")
		expect(endpointsAndCurl).toContain("sequencerPk")
		expect(endpointsAndCurl).toContain("archive")
		expect(endpointsAndCurl).toContain("sendPayment")
		expect(endpointsAndCurl).toContain("1_000_000_000")
		expect(endpointsAndCurl).toContain("from")
		expect(endpointsAndCurl).toContain("to")

		const protocol = fs.readFileSync(
			path.join(referencesDir, "60-sequencer-archive-and-da.md"),
			"utf8"
		)
		expect(protocol).toContain("sequencer")
		expect(protocol).toContain("archive node")
		expect(protocol).toContain("DA layer")

		const navigation = fs.readFileSync(path.join(referencesDir, "10-navigation.md"), "utf8")
		expect(navigation).toContain("https://docs.zeko.io/developers/tools/bridge-cli")
		expect(navigation).toContain("llms-full.txt")
		expect(navigation.toLowerCase()).toContain("fallback")

		const bridgeAndFaucet = fs.readFileSync(
			path.join(referencesDir, "30-bridge-and-faucet.md"),
			"utf8"
		)
		expect(bridgeAndFaucet).toContain("https://docs.zeko.io/developers/tools/bridge-cli")
		expect(bridgeAndFaucet).toContain("WALLET_PRIVATE_KEY")
		expect(bridgeAndFaucet).toContain("zeko-bridge bridge")
		expect(bridgeAndFaucet).toContain("--json")
		expect(bridgeAndFaucet).toContain("doctor")

		const build = fs.readFileSync(path.join(referencesDir, "50-build-on-zeko.md"), "utf8")
		expect(build).toContain("node --input-type=module")
		expect(build).toContain('from "o1js"')
		expect(build).toContain("installed in the current directory")
		expect(build).toContain("PrivateKey.fromBase58")
		expect(build).toContain("toPublicKey")
		expect(build).toContain("PublicKey.fromBase58")
		expect(build.toLowerCase()).toContain("cannot derive a private key from a public key")
	})
})
