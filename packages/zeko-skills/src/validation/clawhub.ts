import fs from "node:fs"
import path from "node:path"
import { referencesDir, skillPath } from "../config.js"
import {
	clawhubInstallPackages,
	clawhubRequiredBins,
	clawhubRequiredEnvVars,
	requiredReferences
} from "../spec.js"
import { assert } from "../utils.js"

const declaredEnvVarSet = new Set<string>(clawhubRequiredEnvVars)

const readSkillFrontmatter = () => {
	const skill = fs.readFileSync(skillPath, "utf8")
	const match = skill.match(/^---\n([\s\S]*?)\n---/)

	assert(Boolean(match), "zeko/SKILL.md is missing YAML frontmatter")

	return match?.[1] ?? ""
}

const collectEnvReferences = () => {
	const referencedEnvVars = new Set<string>()
	const markdownFiles = [
		skillPath,
		...requiredReferences.map((referenceFile) => path.join(referencesDir, referenceFile))
	]

	for (const markdownFile of markdownFiles) {
		const content = fs.readFileSync(markdownFile, "utf8")

		for (const match of content.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) {
			const envVar = match[1]

			if (envVar) {
				referencedEnvVars.add(envVar)
			}
		}

		for (const match of content.matchAll(/`([A-Z][A-Z0-9_]+)`/g)) {
			const envVar = match[1]

			if (
				envVar &&
				(envVar.endsWith("_KEY") ||
					envVar.endsWith("_TOKEN") ||
					envVar.endsWith("_ADDRESS") ||
					envVar === "PUBLIC_KEY" ||
					envVar === "ADDRESS")
			) {
				referencedEnvVars.add(envVar)
			}
		}
	}

	return [...referencedEnvVars].sort((left, right) => left.localeCompare(right))
}

export const validateClawhubMetadata = () => {
	const frontmatter = readSkillFrontmatter()

	assert(
		frontmatter.includes("metadata:"),
		"zeko/SKILL.md is missing metadata frontmatter for registry publication"
	)
	assert(
		frontmatter.includes("  openclaw:"),
		"zeko/SKILL.md is missing metadata.openclaw frontmatter"
	)
	assert(
		frontmatter.includes("    homepage: https://docs.zeko.io/developers/tools/agent-skills"),
		"zeko/SKILL.md must declare the public docs homepage for OpenClaw metadata"
	)
	assert(
		frontmatter.includes("    primaryEnv: MINA_PRIVATE_KEY"),
		"zeko/SKILL.md must declare MINA_PRIVATE_KEY as the primary OpenClaw credential"
	)

	for (const envVar of clawhubRequiredEnvVars) {
		assert(
			frontmatter.includes(`        - ${envVar}`),
			`zeko/SKILL.md must declare ${envVar} in metadata.openclaw.requires.env`
		)
	}

	for (const bin of clawhubRequiredBins) {
		assert(
			frontmatter.includes(`        - ${bin}`),
			`zeko/SKILL.md must declare ${bin} in metadata.openclaw.requires.bins`
		)
	}

	for (const installSpec of clawhubInstallPackages) {
		assert(
			frontmatter.includes(`package: "${installSpec.packageName}"`) ||
				frontmatter.includes(`package: ${installSpec.packageName}`),
			`zeko/SKILL.md must declare an OpenClaw install spec for ${installSpec.packageName}`
		)

		for (const bin of installSpec.bins) {
			assert(
				frontmatter.includes(`          - ${bin}`),
				`zeko/SKILL.md must declare ${bin} in the OpenClaw install spec for ${installSpec.packageName}`
			)
		}
	}

	const undeclaredEnvVars = collectEnvReferences().filter(
		(envVar) => !declaredEnvVarSet.has(envVar)
	)

	assert(
		undeclaredEnvVars.length === 0,
		`Found env vars referenced in the skill but not declared in metadata.openclaw.requires.env: ${undeclaredEnvVars.join(", ")}`
	)
}
