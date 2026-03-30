import fs from "node:fs"
import path from "node:path"
import { packageRoot, skillRoot } from "./config.js"
import { runValidation } from "./validation/index.js"

const packageVersion = JSON.parse(
	fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")
) as { version: string }

export const resolveClawhubPublishVersion = () => {
	const explicitPublishVersion = process.env.ZEKO_SKILLS_CLAWHUB_VERSION?.trim()

	if (explicitPublishVersion) {
		return explicitPublishVersion
	}

	const runNumber = process.env.GITHUB_RUN_NUMBER?.trim()
	const runAttempt = process.env.GITHUB_RUN_ATTEMPT?.trim()

	if (runNumber && runAttempt) {
		return `${packageVersion.version}-main.${runNumber}.${runAttempt}`
	}

	throw new Error("Missing ZEKO_SKILLS_CLAWHUB_VERSION")
}

export const resolveClawhubPublishChangelog = () => {
	const explicitPublishChangelog = process.env.ZEKO_SKILLS_CLAWHUB_CHANGELOG?.trim()

	if (explicitPublishChangelog) {
		return explicitPublishChangelog
	}

	const sha = process.env.GITHUB_SHA?.trim()?.slice(0, 7)

	if (sha) {
		return `Auto-publish from zeko-ui@${sha}`
	}

	return "Publish latest Zeko skill update"
}

export const resolveClawhubPublishTags = () => {
	const tags = process.env.ZEKO_SKILLS_CLAWHUB_TAGS?.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean)

	return tags && tags.length > 0 ? tags : ["latest"]
}

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
	const registry = process.env.CLAWHUB_REGISTRY?.trim() || "https://clawhub.ai"
	const token = process.env.CLAWHUB_TOKEN?.trim()

	if (!token) {
		throw new Error("Missing CLAWHUB_TOKEN")
	}

	const publishVersion = resolveClawhubPublishVersion()
	const publishChangelog = resolveClawhubPublishChangelog()
	const publishTags = resolveClawhubPublishTags()

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
