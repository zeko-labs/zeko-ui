import { readdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import { parseCliArgs, readStringArg } from "../../lib/runtime.ts"

type QueryArtifact = {
	status: "rendered" | "ok" | "error"
	fileName: string
	title: string
	description: string
	renderedSql: string
	outputPath: string
	durationMs?: number
	error?: string
	errorBody?: string
	response?: {
		meta?: Array<{ name: string; type: string }>
		data?: Array<Record<string, unknown>>
		rows?: number | string
		rows_before_limit_at_least?: number | string
	}
}

const coerceCell = (value: unknown): string => {
	if (value == null) {
		return ""
	}

	if (typeof value === "string") {
		return value.replace(/\s+/g, " ").trim()
	}

	return String(value)
}

const renderTable = (rows: Array<Record<string, unknown>>, limit = 10): string => {
	if (rows.length === 0) {
		return "_No rows returned._"
	}

	const previewRows = rows.slice(0, limit)
	const columns = Object.keys(previewRows[0] ?? {})
	const header = `| ${columns.join(" | ")} |`
	const separator = `| ${columns.map(() => "---").join(" | ")} |`
	const body = previewRows.map(
		(row) => `| ${columns.map((column) => coerceCell(row[column])).join(" | ")} |`
	)

	return [header, separator, ...body].join("\n")
}

const renderSummary = (artifacts: QueryArtifact[]): string => {
	const header = "| File | Status | Rows | Duration (ms) |"
	const separator = "| --- | --- | --- | ---: |"
	const body = artifacts.map((artifact) => {
		const rows =
			artifact.status === "ok"
				? coerceCell(artifact.response?.rows ?? artifact.response?.data?.length ?? "")
				: ""
		return `| ${artifact.fileName} | ${artifact.status} | ${rows} | ${artifact.durationMs ?? ""} |`
	})

	return [header, separator, ...body].join("\n")
}

const run = async () => {
	const args = parseCliArgs(process.argv.slice(2))
	const rawDir = readStringArg(args, "raw-dir")
	const outputPath = readStringArg(args, "output")

	if (!rawDir) {
		throw new Error("--raw-dir is required.")
	}

	const absoluteRawDir = resolve(process.cwd(), rawDir)
	const fileNames = (await readdir(absoluteRawDir))
		.filter((fileName) => fileName.endsWith(".json"))
		.sort()
	const artifacts = await Promise.all(
		fileNames.map(async (fileName) => {
			const text = await readFile(resolve(absoluteRawDir, fileName), "utf8")
			return JSON.parse(text) as QueryArtifact
		})
	)
	const lines = [
		"# Bridge Metrics Report",
		"",
		`Generated from \`${absoluteRawDir}\`.`,
		"",
		"## Summary",
		"",
		renderSummary(artifacts),
		""
	]

	for (const artifact of artifacts) {
		lines.push(`## ${artifact.title}`)
		lines.push("")

		if (artifact.description.length > 0) {
			lines.push(artifact.description)
			lines.push("")
		}

		lines.push(`- File: \`${artifact.fileName}\``)
		lines.push(`- Status: \`${artifact.status}\``)

		if (artifact.durationMs !== undefined) {
			lines.push(`- Duration: \`${artifact.durationMs} ms\``)
		}

		if (artifact.status === "ok") {
			lines.push(
				`- Rows: \`${coerceCell(artifact.response?.rows ?? artifact.response?.data?.length ?? "")}\``
			)
			lines.push("")
			lines.push(renderTable(artifact.response?.data ?? []))
		} else if (artifact.status === "error") {
			lines.push("")
			lines.push("```text")
			lines.push(artifact.error ?? "Unknown error")
			if (artifact.errorBody) {
				lines.push(artifact.errorBody)
			}
			lines.push("```")
		} else {
			lines.push("")
			lines.push("_Dry run only; query not executed._")
		}

		lines.push("")
		lines.push("```sql")
		lines.push(artifact.renderedSql)
		lines.push("```")
		lines.push("")
	}

	const report = `${lines.join("\n")}\n`

	if (outputPath) {
		await writeFile(resolve(process.cwd(), outputPath), report, "utf8")
	}

	process.stdout.write(report)

	if (artifacts.some((artifact) => artifact.status === "error")) {
		process.exitCode = 1
	}
}

await run()
