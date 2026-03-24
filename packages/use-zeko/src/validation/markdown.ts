import fs from "node:fs"
import path from "node:path"
import { packageRoot, referencesDir, skillPath, skillRoot } from "../config.js"
import { forbiddenMarkdownPatterns, requiredReferences } from "../spec.js"
import { assert, listMarkdownFiles } from "../utils.js"

const requiredReferenceSet = new Set<string>(requiredReferences)

const collectMarkdownFiles = () => {
	const files = [skillPath, path.join(packageRoot, "README.md")]

	for (const referenceFile of listMarkdownFiles(referencesDir)) {
		files.push(path.join(referencesDir, referenceFile))
	}

	return files
}

export const validateStructure = () => {
	assert(fs.existsSync(skillRoot), "Missing zeko skill directory")
	assert(fs.existsSync(skillPath), "Missing zeko/SKILL.md")
	assert(fs.existsSync(referencesDir), "Missing zeko/references directory")

	const skill = fs.readFileSync(skillPath, "utf8")
	const actualReferences = listMarkdownFiles(referencesDir)

	for (const requiredReference of requiredReferences) {
		assert(
			actualReferences.includes(requiredReference),
			`Missing required reference file: ${requiredReference}`
		)
		assert(
			skill.includes(`references/${requiredReference}`),
			`Root skill does not directly link references/${requiredReference}`
		)
	}

	for (const actualReference of actualReferences) {
		assert(
			requiredReferenceSet.has(actualReference),
			`Found orphan reference file not linked from the root skill: ${actualReference}`
		)
	}
}

export const validateSelfContainedMarkdown = () => {
	for (const markdownFile of collectMarkdownFiles()) {
		const content = fs.readFileSync(markdownFile, "utf8")

		for (const pattern of forbiddenMarkdownPatterns) {
			assert(
				!pattern.test(content),
				`Forbidden local-path reference in ${path.relative(packageRoot, markdownFile)}`
			)
		}
	}
}
