import fs from "node:fs"
import path from "node:path"
import { skillRoot } from "./config.js"
import { runValidation } from "./validation/index.js"

const registry = process.env.CLAWHUB_REGISTRY?.trim() || "https://clawhub.ai"
const token = process.env.CLAWHUB_TOKEN?.trim()
const publishVersion = process.env.ZEKO_SKILLS_CLAWHUB_VERSION?.trim()
const publishChangelog =
	process.env.ZEKO_SKILLS_CLAWHUB_CHANGELOG?.trim() || "Publish latest Zeko skill update"
const publishTags = process.env.ZEKO_SKILLS_CLAWHUB_TAGS?.split(",")
	.map((tag) => tag.trim())
	.filter(Boolean) || ["latest"]

const collectTextFiles = (
	directory: string,
	root = directory
): { absolutePath: string; relPath: string }[] => {
	const files: { absolutePath: string; relPath: string }[] = []

	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) {
			continue
		}

		const absolutePath = path.join(directory, entry.name)

		if (entry.isDirectory()) {
			files.push(...collectTextFiles(absolutePath, root))
			continue
		}

		if (!entry.isFile()) {
			continue
		}

		files.push({
			absolutePath,
			relPath: path.relative(root, absolutePath).split(path.sep).join("/")
		})
	}

	return files.sort((left, right) => left.relPath.localeCompare(right.relPath))
}

export const publishClawhub = async () => {
	if (!token) {
		throw new Error("Missing CLAWHUB_TOKEN")
	}

	if (!publishVersion) {
		throw new Error("Missing ZEKO_SKILLS_CLAWHUB_VERSION")
	}

	await runValidation()

	const form = new FormData()
	form.set(
		"payload",
		JSON.stringify({
			slug: "zeko",
			displayName: "Zeko",
			version: publishVersion,
			changelog: publishChangelog,
			acceptLicenseTerms: true,
			tags: publishTags
		})
	)

	for (const file of collectTextFiles(skillRoot)) {
		form.append(
			"files",
			new Blob([fs.readFileSync(file.absolutePath)], { type: "text/plain" }),
			file.relPath
		)
	}

	const response = await fetch(new URL("/api/v1/skills", registry), {
		method: "POST",
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${token}`
		},
		body: form
	})

	const responseText = await response.text()

	if (!response.ok) {
		throw new Error(`ClawHub publish failed (${response.status}): ${responseText}`)
	}

	const result = JSON.parse(responseText) as { versionId?: string }
	const versionId = result.versionId ? ` (${result.versionId})` : ""

	console.log(`Published zeko@${publishVersion}${versionId} to ${registry}`)
}
