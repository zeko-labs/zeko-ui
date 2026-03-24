import fs from "node:fs"
import path from "node:path"
import { repoRoot } from "./config.js"

export const assert = (condition: boolean, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

export const listMarkdownFiles = (directory: string, prefix = ""): string[] => {
	const files: string[] = []

	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			files.push(...listMarkdownFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`))
			continue
		}

		if (entry.isFile() && entry.name.endsWith(".md")) {
			files.push(`${prefix}${entry.name}`)
		}
	}

	return files.sort((left, right) => left.localeCompare(right))
}

export const normalizePath = (filePath: string) => path.normalize(filePath)

export const endsWithPathSegment = (filePath: string, suffix: string) => {
	const normalizedFilePath = normalizePath(filePath)
	const normalizedSuffix = normalizePath(suffix)

	return (
		normalizedFilePath === normalizedSuffix ||
		normalizedFilePath.endsWith(`${path.sep}${normalizedSuffix}`)
	)
}

export const readRepoFile = (relativePath: string) => {
	const absolutePath = path.resolve(repoRoot, relativePath)
	return { absolutePath, content: fs.readFileSync(absolutePath, "utf8") }
}
