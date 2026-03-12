import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { loadQueryTemplate, renderQueryTemplate } from "../../lib/sql.ts"
import {
	OBSERVABILITY_ROOT,
	parseCliArgs,
	readStringArg,
	resolveAeDataset,
	resolveLiveAeConfig
} from "../../lib/runtime.ts"

type QueryResponse = {
	meta?: Array<{ name: string; type: string }>
	data?: Array<Record<string, unknown>>
}

const defaultQueryPath = resolve(OBSERVABILITY_ROOT, "sentry/errors-export.sql")

const escapeCsvCell = (value: unknown): string => {
	const text = value == null ? "" : typeof value === "string" ? value : String(value)

	return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const toCsv = ({
	columns,
	rows
}: {
	columns: string[]
	rows: Array<Record<string, unknown>>
}): string => {
	const header = columns.map(escapeCsvCell).join(",")
	const body = rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(","))

	return `${[header, ...body].join("\n")}\n`
}

const run = async () => {
	const args = parseCliArgs(process.argv.slice(2))
	const queryPath = resolve(
		process.cwd(),
		readStringArg(args, "query", defaultQueryPath) ?? defaultQueryPath
	)
	const windowOverride = readStringArg(args, "window")
	const outputPath = readStringArg(args, "output")
	const template = await loadQueryTemplate(queryPath)
	const sql = renderQueryTemplate({
		template,
		mode: "live",
		dataset: resolveAeDataset(),
		windowOverride
	})
	const { accountId, token } = resolveLiveAeConfig()
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "text/plain",
				Accept: "application/json"
			},
			body: sql,
			signal: AbortSignal.timeout(30_000)
		}
	)
	const text = await response.text()

	if (!response.ok) {
		throw new Error(`AE export failed: HTTP ${response.status} ${response.statusText}\n${text}`)
	}

	const parsed = (text.length > 0 ? JSON.parse(text) : {}) as QueryResponse
	const rows = parsed.data ?? []
	const columns =
		parsed.meta?.map((column) => column.name) ??
		Object.keys(rows[0] ?? { category: "", action: "", label: "", occurrences: "" })
	const csv = toCsv({ columns, rows })

	if (outputPath) {
		const absoluteOutputPath = resolve(process.cwd(), outputPath)
		await mkdir(dirname(absoluteOutputPath), { recursive: true })
		await writeFile(absoluteOutputPath, csv, "utf8")
		console.error(`wrote ${absoluteOutputPath}`)
	}

	process.stdout.write(csv)
}

await run()
