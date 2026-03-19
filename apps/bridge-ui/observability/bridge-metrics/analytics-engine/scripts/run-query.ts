import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { performance } from "node:perf_hooks"
import { loadQueryTemplate, renderQueryTemplate, toArtifactName } from "../../lib/sql.ts"
import {
	parseCliArgs,
	readStringArg,
	resolveAeDataset,
	resolveLiveAeConfig,
	type RenderMode
} from "../../lib/runtime.ts"

type QueryResult =
	| {
			status: "rendered"
			fileName: string
			title: string
			description: string
			renderedSql: string
			outputPath: string
	  }
	| {
			status: "ok"
			fileName: string
			title: string
			description: string
			renderedSql: string
			outputPath: string
			durationMs: number
			response: unknown
	  }
	| {
			status: "error"
			fileName: string
			title: string
			description: string
			renderedSql: string
			outputPath: string
			durationMs: number
			error: string
			errorBody?: string
	  }

const run = async () => {
	const args = parseCliArgs(process.argv.slice(2))
	const filePath = readStringArg(args, "file")
	const mode = (readStringArg(args, "mode", "live") ?? "live") as RenderMode
	const rawDir = readStringArg(args, "raw-dir")
	const windowOverride = readStringArg(args, "window")

	if (!filePath) {
		throw new Error("--file is required.")
	}

	if (!rawDir) {
		throw new Error("--raw-dir is required.")
	}

	const absoluteFilePath = resolve(process.cwd(), filePath)
	const absoluteRawDir = resolve(process.cwd(), rawDir)
	const template = await loadQueryTemplate(absoluteFilePath)
	const renderedSql = renderQueryTemplate({
		template,
		mode,
		dataset: resolveAeDataset(),
		windowOverride
	})
	const outputPath = join(absoluteRawDir, toArtifactName(template.fileName))

	await mkdir(dirname(outputPath), { recursive: true })

	if (mode === "render") {
		const payload: QueryResult = {
			status: "rendered",
			fileName: template.fileName,
			title: template.title,
			description: template.description,
			renderedSql,
			outputPath
		}
		await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
		console.log(`rendered ${template.fileName}`)
		return
	}

	const { accountId, token } = resolveLiveAeConfig()
	const startedAt = performance.now()

	try {
		const response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "text/plain",
					Accept: "application/json"
				},
				body: renderedSql,
				signal: AbortSignal.timeout(30_000)
			}
		)
		const text = await response.text()
		const durationMs = Number((performance.now() - startedAt).toFixed(2))

		if (!response.ok) {
			const payload: QueryResult = {
				status: "error",
				fileName: template.fileName,
				title: template.title,
				description: template.description,
				renderedSql,
				outputPath,
				durationMs,
				error: `HTTP ${response.status} ${response.statusText}`,
				errorBody: text
			}
			await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
			console.error(`error ${template.fileName}: HTTP ${response.status}`)
			process.exitCode = 1
			return
		}

		const parsedResponse = text.length > 0 ? JSON.parse(text) : null
		const payload: QueryResult = {
			status: "ok",
			fileName: template.fileName,
			title: template.title,
			description: template.description,
			renderedSql,
			outputPath,
			durationMs,
			response: parsedResponse
		}
		await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
		const rows =
			parsedResponse && typeof parsedResponse === "object" && "rows" in parsedResponse
				? String((parsedResponse as { rows: unknown }).rows)
				: "?"
		console.log(`ok ${template.fileName} (${rows} rows, ${durationMs} ms)`)
	} catch (error) {
		const durationMs = Number((performance.now() - startedAt).toFixed(2))
		const payload: QueryResult = {
			status: "error",
			fileName: template.fileName,
			title: template.title,
			description: template.description,
			renderedSql,
			outputPath,
			durationMs,
			error: error instanceof Error ? error.message : String(error)
		}
		await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
		console.error(`error ${template.fileName}: ${payload.error}`)
		process.exitCode = 1
	}
}

await run()
