import fs from "node:fs"
import path from "node:path"
import { packageRoot, repoRoot, syncedReferences } from "./spec.js"

const extractSection = ({
	source,
	includeFromHeading,
	stopBeforeHeading
}: {
	source: string
	includeFromHeading: string
	stopBeforeHeading: string
}) => {
	const startIndex = source.indexOf(includeFromHeading)
	if (startIndex === -1) {
		throw new Error(`Missing heading ${includeFromHeading}`)
	}

	const endIndex = source.indexOf(stopBeforeHeading, startIndex)
	if (endIndex === -1) {
		throw new Error(`Missing stop heading ${stopBeforeHeading}`)
	}

	return source.slice(startIndex, endIndex).trim()
}

export const generateSyncedReferences = () =>
	syncedReferences.map((entry) => {
		const sourcePath = path.resolve(repoRoot, entry.sourcePath)
		if (!fs.existsSync(sourcePath)) {
			throw new Error(`Missing source for synced reference: ${entry.sourcePath}`)
		}

		const source = fs.readFileSync(sourcePath, "utf8")
		const extracted = extractSection({
			source,
			includeFromHeading: entry.includeFromHeading,
			stopBeforeHeading: entry.stopBeforeHeading
		})
		const content = `${entry.title}\n\nGenerated from the canonical public README.\n\n${extracted}\n`
		return {
			targetPath: entry.targetPath,
			content
		}
	})

export const syncSources = () => {
	for (const generated of generateSyncedReferences()) {
		const targetPath = path.join(packageRoot, generated.targetPath)
		fs.mkdirSync(path.dirname(targetPath), { recursive: true })
		fs.writeFileSync(targetPath, generated.content, "utf8")
	}
}
