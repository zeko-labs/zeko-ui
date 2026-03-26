import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, test, vi } from "vitest"

const CONTENT_DIR = fileURLToPath(new URL("../content", import.meta.url))
const FETCH_TIMEOUT_MS = 15_000
const CONCURRENCY = 5
const LINK_TEST_TIMEOUT_MS = 180_000
const MAX_FETCH_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 500

type CheckStatus = number | "timeout" | "error"

interface CheckResult {
	status: CheckStatus
	error?: string
}

interface CheckUrlOptions {
	maxAttempts?: number
	retryBaseDelayMs?: number
	sleep?: (ms: number) => Promise<void>
}

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

function isBotBlocked(status: CheckStatus): boolean {
	return status === 403 || status === 429
}

function isRetryable(status: CheckStatus): boolean {
	if (status === "timeout" || status === "error") return true
	return isBotBlocked(status) || status === 408 || status >= 500
}

async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms))
}

function isOk(status: CheckStatus): boolean {
	return typeof status === "number" && status < 400
}

async function checkUrl(url: string, options: CheckUrlOptions = {}): Promise<CheckResult> {
	const maxAttempts = options.maxAttempts ?? MAX_FETCH_ATTEMPTS
	const retryBaseDelayMs = options.retryBaseDelayMs ?? RETRY_BASE_DELAY_MS
	const wait = options.sleep ?? sleep

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
			return { status: res.status as CheckStatus }
		} catch (err) {
			clearTimeout(timer)
			if ((err as Error).name === "AbortError") return { status: "timeout" as const }
			return { status: "error" as const, error: (err as Error).message }
		}
	}

	const runAttempt = async (): Promise<CheckResult> => {
		const head = await tryFetch("HEAD")
		if (!isOk(head.status)) {
			return tryFetch("GET")
		}
		return head
	}

	let result: CheckResult = { status: "error", error: "No attempts were made" }
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		result = await runAttempt()
		if (!isRetryable(result.status) || attempt === maxAttempts - 1) {
			return result
		}

		await wait(retryBaseDelayMs * 2 ** attempt)
	}

	return result
}

type Category = "ok" | "bot_blocked" | "broken" | "unreachable" | "transient_host_failure"

function isTransientGitHubFailure(url: string, status: CheckStatus): boolean {
	if (typeof status !== "number" || status < 500) return false

	const hostname = new URL(url).hostname.toLowerCase()
	return hostname === "github.com" || hostname.endsWith(".github.com")
}

function categorize(url: string, status: CheckStatus): Category {
	if (status === "timeout" || status === "error") return "unreachable"
	if (isBotBlocked(status)) return "bot_blocked"
	if (isTransientGitHubFailure(url, status)) return "transient_host_failure"
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

describe("checkUrl", () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	test("retries transient server failures", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({ status: 503 } as Response)
			.mockResolvedValueOnce({ status: 200 } as Response)
		vi.stubGlobal("fetch", fetchMock)

		const result = await checkUrl("https://example.com", {
			sleep: async () => undefined
		})

		expect(result.status).toBe(200)
		expect(fetchMock).toHaveBeenCalledTimes(2)
	})

	test("retries bot-blocked responses after a GET fallback", async () => {
		const methods: string[] = []
		const responses = [{ status: 403 }, { status: 403 }, { status: 200 }]
		const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
			methods.push(init?.method ?? "GET")
			return responses.shift() as Response
		})
		vi.stubGlobal("fetch", fetchMock)

		const result = await checkUrl("https://example.com", {
			sleep: async () => undefined
		})

		expect(result.status).toBe(200)
		expect(methods).toEqual(["HEAD", "GET", "HEAD"])
	})

	test("falls back to GET when HEAD errors", async () => {
		const methods: string[] = []
		const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
			const method = init?.method ?? "GET"
			methods.push(method)
			if (method === "HEAD") {
				throw new TypeError("fetch failed")
			}
			return { status: 200 } as Response
		})
		vi.stubGlobal("fetch", fetchMock)

		const result = await checkUrl("https://example.com", {
			sleep: async () => undefined
		})

		expect(result.status).toBe(200)
		expect(methods).toEqual(["HEAD", "GET"])
	})

	test("treats GitHub 5xx responses as transient host failures", () => {
		expect(categorize("https://github.com/MinaFoundation/mina-fungible-token", 502)).toBe(
			"transient_host_failure"
		)
		expect(categorize("https://github.com/MinaFoundation/mina-fungible-token", 404)).toBe("broken")
		expect(categorize("https://docs.zeko.io", 502)).toBe("broken")
	})
})

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
				const category = categorize(url, result.status)
				if (
					category === "ok" ||
					category === "bot_blocked" ||
					category === "transient_host_failure"
				) {
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
