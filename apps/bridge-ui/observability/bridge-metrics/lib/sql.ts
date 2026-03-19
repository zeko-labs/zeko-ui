import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import type { RenderMode } from "./runtime.ts"

export type QueryTemplate = {
	id: string
	fileName: string
	filePath: string
	title: string
	description: string
	defaultWindow: string
	body: string
}

const TIME_FILTER_PATTERN = /\{\{time_filter:([^}]+)\}\}/g
const DATASET_PATTERN = /\{\{dataset\}\}/g
const WINDOW_PATTERN = /^(\d+)([mhdw])$/

const renderWindowInterval = (window: string): string => {
	const match = WINDOW_PATTERN.exec(window.trim())

	if (!match) {
		throw new Error(`Unsupported time window "${window}". Use <count><m|h|d|w>.`)
	}

	const [, amount, unit] = match
	const keyword =
		{
			m: "MINUTE",
			h: "HOUR",
			d: "DAY",
			w: "WEEK"
		}[unit] ?? null

	if (!keyword) {
		throw new Error(`Unsupported time unit "${unit}" in "${window}".`)
	}

	return `timestamp >= NOW() - INTERVAL '${amount}' ${keyword}`
}

const readHeaderMetadata = (source: string): Record<string, string> => {
	const metadata: Record<string, string> = {}

	for (const line of source.split("\n")) {
		if (!line.startsWith("-- ")) {
			if (line.trim().length === 0) {
				continue
			}
			break
		}

		const separatorIndex = line.indexOf(":")

		if (separatorIndex < 0) {
			continue
		}

		const key = line.slice(3, separatorIndex).trim()
		const value = line.slice(separatorIndex + 1).trim()

		if (key.length > 0 && value.length > 0) {
			metadata[key] = value
		}
	}

	return metadata
}

export const loadQueryTemplate = async (filePath: string): Promise<QueryTemplate> => {
	const source = await readFile(filePath, "utf8")
	const metadata = readHeaderMetadata(source)
	const fileName = basename(filePath)

	return {
		id: fileName.replace(/\.sql$/, ""),
		fileName,
		filePath,
		title: metadata.title ?? fileName,
		description: metadata.description ?? "",
		defaultWindow: metadata.default_window ?? "7d",
		body: source.trim()
	}
}

export const renderQueryTemplate = ({
	template,
	mode,
	dataset,
	windowOverride
}: {
	template: QueryTemplate
	mode: RenderMode
	dataset: string
	windowOverride?: string
}): string => {
	const renderedDataset = template.body.replace(DATASET_PATTERN, dataset)

	return renderedDataset.replace(TIME_FILTER_PATTERN, (_fullMatch, defaultWindow: string) => {
		const effectiveWindow = windowOverride ?? defaultWindow.trim()
		return mode === "grafana"
			? "$timeFilterByColumn(timestamp)"
			: renderWindowInterval(effectiveWindow)
	})
}

export const toArtifactName = (fileName: string): string => fileName.replace(/\.sql$/, ".json")
