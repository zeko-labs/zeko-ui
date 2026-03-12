import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { classifyAeErrorRow, summarizeAuditLabel, type AeErrorRow } from "../classify-ae-error.ts"
import {
	BRIDGE_UI_ROOT,
	OBSERVABILITY_ROOT,
	parseCliArgs,
	readStringArg
} from "../../lib/runtime.ts"

const defaultInputPath = "/Users/hebilicious/Downloads/errors.csv"
const defaultJsonPath = resolve(OBSERVABILITY_ROOT, "sentry/bridge-ae-errors.audit.json")
const defaultMarkdownPath = resolve(OBSERVABILITY_ROOT, "sentry/bridge-ae-errors.audit.md")

const parseCsvRecords = (source: string): string[][] => {
	const records: string[][] = []
	let row: string[] = []
	let current = ""
	let quoted = false

	for (let index = 0; index < source.length; index += 1) {
		const char = source[index]
		const next = source[index + 1]

		if (char === '"' && quoted && next === '"') {
			current += '"'
			index += 1
			continue
		}

		if (char === '"') {
			quoted = !quoted
			continue
		}

		if (char === "," && !quoted) {
			row.push(current)
			current = ""
			continue
		}

		if ((char === "\n" || char === "\r") && !quoted) {
			if (char === "\r" && next === "\n") {
				index += 1
			}

			row.push(current)
			if (row.some((cell) => cell.length > 0)) {
				records.push(row)
			}
			row = []
			current = ""
			continue
		}

		current += char
	}

	row.push(current)

	if (row.some((cell) => cell.length > 0)) {
		records.push(row)
	}

	return records
}

const parseCsv = (source: string): AeErrorRow[] => {
	const records = parseCsvRecords(source)

	return records.slice(1).map((cells) => ({
		category: cells[0] ?? "",
		action: cells[1] ?? "",
		label: cells[2] ?? "",
		occurrences: Number(cells[3] ?? "0")
	}))
}

const renderMarkdown = (rows: ReturnType<typeof classifyAeErrorRow>[]) => {
	const lines = [
		"# Bridge AE Error Audit",
		"",
		"Generated from `/Users/hebilicious/Downloads/errors.csv`.",
		"",
		"## Summary",
		"",
		`- Unique tuples: ${rows.length}`,
		`- Should capture: ${rows.filter((row) => row.expectedSentryBehavior === "should-capture").length}`,
		`- Should not capture: ${rows.filter((row) => row.expectedSentryBehavior === "should-not-capture").length}`,
		`- Needs repro: ${rows.filter((row) => row.expectedSentryBehavior === "needs-repro").length}`,
		"",
		"## Classification",
		"",
		"| Category | Action | Label summary | Occurrences | Expected Sentry | Current behavior |",
		"| --- | --- | --- | ---: | --- | --- |"
	]

	for (const row of rows) {
		lines.push(
			`| ${row.category} | ${row.action} | ${row.labelSummary.replace(/\|/g, "\\|")} | ${row.occurrences} | ${row.expectedSentryBehavior} | ${row.currentBehavior} |`
		)
	}

	for (const row of rows) {
		lines.push("")
		lines.push(`## ${row.category} / ${row.action}`)
		lines.push("")
		lines.push(`- Label summary: \`${row.labelSummary}\``)
		lines.push(`- Occurrences: \`${row.occurrences}\``)
		lines.push(`- Code path: ${row.codePath}`)
		lines.push(`- Current handling: ${row.currentHandling}`)
		lines.push(`- Expected Sentry behavior: \`${row.expectedSentryBehavior}\``)
		lines.push(`- Current behavior: \`${row.currentBehavior}\``)
		lines.push(`- Reason: ${row.reason}`)
	}

	return `${lines.join("\n")}\n`
}

const run = async () => {
	const args = parseCliArgs(process.argv.slice(2))
	const inputPath = readStringArg(args, "input", defaultInputPath) ?? defaultInputPath
	const jsonPath = resolve(
		BRIDGE_UI_ROOT,
		readStringArg(args, "json-output", defaultJsonPath) ?? defaultJsonPath
	)
	const markdownPath = resolve(
		BRIDGE_UI_ROOT,
		readStringArg(args, "markdown-output", defaultMarkdownPath) ?? defaultMarkdownPath
	)
	const source = await readFile(inputPath, "utf8")
	const rows = parseCsv(source).map(classifyAeErrorRow)
	const json = `${JSON.stringify(rows, null, 2)}\n`
	const markdown = renderMarkdown(rows)

	await mkdir(dirname(jsonPath), { recursive: true })
	await writeFile(jsonPath, json, "utf8")
	await writeFile(markdownPath, markdown, "utf8")

	console.log(`wrote ${jsonPath}`)
	console.log(`wrote ${markdownPath}`)
	console.log(`classified ${rows.length} tuples`)

	const uncovered = rows.filter((row) => row.reason.includes("dedicated audit rule"))

	if (uncovered.length > 0) {
		console.error(
			`Uncovered tuples: ${uncovered.map((row) => `${row.category}/${row.action}/${summarizeAuditLabel(row.label)}`).join(", ")}`
		)
		process.exitCode = 1
	}
}

await run()
