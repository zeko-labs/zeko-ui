import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const CONTENT_DIR = fileURLToPath(new URL("../content", import.meta.url))
const FETCH_TIMEOUT_MS = 15_000
const CONCURRENCY = 10
const LINK_TEST_TIMEOUT_MS = 120_000

interface LinkOccurrence {
	file: string
	line: number
}

function extractLinks(
	content: string,
	filePath: string
): Array<{ file: string; line: number; url: string }> {
	const results: Array<{ file: string; line: number; url: string }> = []
	const withoutFencedBlocks = content.replace(/```[\s\S]*?```/g, (match) =>
		"\n".repeat(match.split("\n").length - 1)
	)
	const lines = withoutFencedBlocks.split("\n")
	const mdLinkRegex = /!?\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g
	for (let i = 0; i < lines.length; i++) {
		let match: RegExpExecArray | null
		const lineRegex = new RegExp(mdLinkRegex.source, "g")
		while ((match = lineRegex.exec(lines[i])) !== null) {
			const url = match[1].replace(/[.,;:!?]+$/, "")
			results.push({ file: filePath, line: i + 1, url })
		}
	}
	return results
}

async function walkMarkdown(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true, recursive: true })
	return entries
		.filter((e) => e.isFile() && e.name.endsWith(".md"))
		.map((e) => join(e.parentPath ?? e.path, e.name))
}

async function checkUrl(
	url: string
): Promise<{ status: number | "timeout" | "error"; error?: string }> {
	const tryFetch = async (method: "HEAD" | "GET") => {
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
		try {
			const res = await fetch(url, {
				method,
				signal: controller.signal,
				headers: { "User-Agent": "Mozilla/5.0 (compatible; link-checker/1.0)" },
				redirect: "follow"
			})
			clearTimeout(timer)
			return { status: res.status as number | "timeout" | "error" }
		} catch (err) {
			clearTimeout(timer)
			if ((err as Error).name === "AbortError") return { status: "timeout" as const }
			return { status: "error" as const, error: (err as Error).message }
		}
	}

	const head = await tryFetch("HEAD")
	if (head.status === 405 || head.status === 404) {
		return tryFetch("GET")
	}
	return head
}

type Category = "ok" | "bot_blocked" | "broken" | "unreachable"

function categorize(status: number | "timeout" | "error"): Category {
	if (status === "timeout" || status === "error") return "unreachable"
	if (status === 403 || status === 429) return "bot_blocked"
	if (status >= 400) return "broken"
	return "ok"
}

async function runWithConcurrency<T>(
	tasks: Array<() => Promise<T>>,
	concurrency: number
): Promise<T[]> {
	const results: T[] = []
	let index = 0
	async function worker() {
		while (index < tasks.length) {
			const i = index++
			results[i] = await tasks[i]()
		}
	}
	await Promise.all(Array.from({ length: concurrency }, worker))
	return results
}

describe("documentation links", () => {
	const linkTest = process.env.CI ? test : test.skip

	linkTest(
		"checks external markdown links",
		async () => {
			const files = await walkMarkdown(CONTENT_DIR)
			const urlMap = new Map<string, Array<LinkOccurrence>>()
			for (const file of files) {
				const content = await readFile(file, "utf8")
				const links = extractLinks(content, relative(CONTENT_DIR, file))
				for (const { file: linkedFile, line, url } of links) {
					if (!urlMap.has(url)) urlMap.set(url, [])
					urlMap.get(url)!.push({ file: linkedFile, line })
				}
			}

			const urlEntries = [...urlMap.entries()]
			const checkResults = await runWithConcurrency(
				urlEntries.map(
					([url]) =>
						() =>
							checkUrl(url)
				),
				CONCURRENCY
			)
			const failures = urlEntries.flatMap(([url, occurrences], index) => {
				const result = checkResults[index]
				const category = categorize(result.status)
				if (category === "ok" || category === "bot_blocked") {
					return []
				}

				const locations = occurrences.map((o) => `  ${o.file}:${o.line}`).join("\n")
				return [
					`${url}\n[${result.status}]${result.error ? ` ${result.error}` : ""} — found in:\n${locations}`
				]
			})

			expect(failures, failures.join("\n\n")).toEqual([])
		},
		LINK_TEST_TIMEOUT_MS
	)
})
