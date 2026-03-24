import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
	type EndpointCheck,
	type EvalCase,
	endpointChecks,
	evalCases,
	forbiddenMarkdownPatterns,
	packageRoot,
	repoRoot,
	requiredReferences,
	skillRoot,
	skippedExternalLinkChecks
} from "./spec.js"

const SKILL_PATH = path.join(skillRoot, "SKILL.md")
const REFERENCES_DIR = path.join(skillRoot, "references")
const requiredReferenceSet = new Set<string>(requiredReferences)
const INSTALLED_SKILL_ROOT = path.join(repoRoot, ".agents", "skills", "zeko")
const INSTALLED_SKILL_PATH = path.join(INSTALLED_SKILL_ROOT, "SKILL.md")
const INSTALLED_REFERENCES_DIR = path.join(INSTALLED_SKILL_ROOT, "references")
const OPENCODE_DEFAULT_MODEL = process.env.USE_ZEKO_EVAL_MODEL ?? "opencode/gpt-5-nano"
const OPENCODE_TIMEOUT_MS = Number(process.env.USE_ZEKO_EVAL_TIMEOUT_MS ?? "180000")
const OPENCODE_ATTEMPTS = Number(process.env.USE_ZEKO_EVAL_ATTEMPTS ?? "3")

type OpencodeTextEvent = {
	type: "text"
	part?: {
		text?: string
	}
}

type OpencodeToolUseEvent = {
	type: "tool_use"
	part?: {
		tool?: string
		state?: {
			input?: {
				filePath?: string
			}
		}
	}
}

type OpencodeEvent = OpencodeTextEvent | OpencodeToolUseEvent | { type: string }
const listReferenceFiles = (directory: string, prefix = ""): string[] => {
	const files: string[] = []

	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			files.push(...listReferenceFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`))
			continue
		}

		if (entry.isFile() && entry.name.endsWith(".md")) {
			files.push(`${prefix}${entry.name}`)
		}
	}

	return files.sort((left, right) => left.localeCompare(right))
}

const assert = (condition: boolean, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

const normalizePath = (filePath: string) => path.normalize(path.resolve(filePath))
const endsWithPathSegment = (filePath: string, suffix: string) =>
	normalizePath(filePath).endsWith(normalizePath(suffix))

const isSkillRootRead = (filePath: string) =>
	endsWithPathSegment(filePath, path.join(".agents", "skills", "zeko", "SKILL.md")) ||
	endsWithPathSegment(filePath, path.join(".claude", "skills", "zeko", "SKILL.md")) ||
	endsWithPathSegment(filePath, path.join("packages", "use-zeko", "zeko", "SKILL.md"))

const isExpectedReferenceRead = (filePath: string, referenceFile: string) =>
	endsWithPathSegment(
		filePath,
		path.join(".agents", "skills", "zeko", "references", referenceFile)
	) ||
	endsWithPathSegment(
		filePath,
		path.join(".claude", "skills", "zeko", "references", referenceFile)
	) ||
	endsWithPathSegment(
		filePath,
		path.join("packages", "use-zeko", "zeko", "references", referenceFile)
	) ||
	endsWithPathSegment(filePath, path.join("references", referenceFile))

const readRepoFile = (relativePath: string) => {
	const absolutePath = path.resolve(repoRoot, relativePath)
	return { absolutePath, content: fs.readFileSync(absolutePath, "utf8") }
}

const collectMarkdownFiles = () => {
	const files = [SKILL_PATH, path.join(packageRoot, "README.md")]

	for (const referenceFile of listReferenceFiles(REFERENCES_DIR)) {
		files.push(path.join(REFERENCES_DIR, referenceFile))
	}

	return files
}

export const validateStructure = () => {
	assert(fs.existsSync(skillRoot), "Missing zeko skill directory")
	assert(fs.existsSync(SKILL_PATH), "Missing zeko/SKILL.md")
	assert(fs.existsSync(REFERENCES_DIR), "Missing zeko/references directory")

	const skill = fs.readFileSync(SKILL_PATH, "utf8")
	const actualReferences = listReferenceFiles(REFERENCES_DIR)

	for (const requiredReference of requiredReferences) {
		assert(
			actualReferences.includes(requiredReference),
			`Missing required reference file: ${requiredReference}`
		)
		assert(
			skill.includes(`references/${requiredReference}`),
			`Root skill does not directly link references/${requiredReference}`
		)
	}

	for (const actualReference of actualReferences) {
		assert(
			requiredReferenceSet.has(actualReference),
			`Found orphan reference file not linked from the root skill: ${actualReference}`
		)
	}
}

export const validateSelfContainedMarkdown = () => {
	for (const markdownFile of collectMarkdownFiles()) {
		const content = fs.readFileSync(markdownFile, "utf8")
		for (const pattern of forbiddenMarkdownPatterns) {
			assert(
				!pattern.test(content),
				`Forbidden local-path reference in ${path.relative(packageRoot, markdownFile)}`
			)
		}
	}
}

const validateEndpointCheck = ({ name, expected, sources }: EndpointCheck) => {
	for (const relativePath of sources) {
		const { content } = readRepoFile(relativePath)
		assert(content.includes(expected), `Endpoint ${name} missing from ${relativePath}: ${expected}`)
	}
}

export const validateEndpoints = () => {
	for (const endpointCheck of endpointChecks) {
		validateEndpointCheck(endpointCheck)
	}
}

const isGraphQlEndpoint = (url: string) =>
	url.endsWith("/graphql") ||
	url.includes("gateway.mina.devnet.zeko.io") ||
	url.includes("gateway.mina.archive.devnet.zeko.io") ||
	url === "https://testnet.zeko.io"

const extractExternalLinks = () => {
	const urls = new Set<string>()

	for (const filePath of collectMarkdownFiles()) {
		const content = fs.readFileSync(filePath, "utf8")
		for (const match of content.matchAll(/https:\/\/[^\s)`"'<>]+/g)) {
			urls.add(match[0])
		}
	}

	return Array.from(urls).sort((left, right) => left.localeCompare(right))
}

const checkExternalLink = (url: string) => {
	const graphQlEndpoint = isGraphQlEndpoint(url)
	const isClaimEndpoint = url.endsWith("/claim")
	const args = ["-sS", "-L", "-o", "/dev/null", "-w", "%{http_code}"]

	if (graphQlEndpoint || isClaimEndpoint) {
		args.push("-X", "POST", "-H", "Content-Type: application/json")
		args.push(
			"-d",
			graphQlEndpoint ? JSON.stringify({ query: "{ __typename }" }) : JSON.stringify({})
		)
	}

	args.push(url)

	return execFileSync("curl", args, {
		encoding: "utf8",
		timeout: 20_000
	}).trim()
}

export const validateExternalLinks = async () => {
	for (const url of extractExternalLinks()) {
		if (skippedExternalLinkChecks.has(url)) {
			continue
		}

		let status: number
		try {
			status = Number(checkExternalLink(url))
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			throw new Error(`External link check failed for ${url}: ${message}`)
		}

		const isApiEndpoint = isGraphQlEndpoint(url) || url.endsWith("/claim")
		const acceptedStatuses = isApiEndpoint ? [200, 400, 401, 403, 405] : [200]
		assert(
			acceptedStatuses.includes(status),
			`External link check failed for ${url}: HTTP ${status}`
		)
	}
}

export const runValidation = async () => {
	validateStructure()
	validateSelfContainedMarkdown()
	validateEndpoints()
	await validateExternalLinks()
}

const buildOpencodeEvalPrompt = (evalCase: EvalCase) => `You are being evaluated on whether you can answer a Zeko question by using the local zeko skill in this repository.

Requirements:
- Follow the repository AGENTS instructions and available skills.
- If the zeko skill applies, read \`.agents/skills/zeko/SKILL.md\` and then only the smallest relevant reference files.
- Relevant in-skill reference candidates for this question:
${evalCase.expectedReferences.map((referenceFile) => `  - .agents/skills/zeko/references/${referenceFile}`).join("\n")}
- You must read at least one of those candidate reference files before answering.
- Do not use web search unless the local skill is insufficient.
- Answer the user's question directly.
- End your response with a final line exactly in this format: \`EVAL_SKILL_USED: zeko\`.

User question:
${evalCase.prompt}
`

const parseOpencodeEvents = (output: string) =>
	output
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => JSON.parse(line) as OpencodeEvent)

const runOpencodeEvalCase = (evalCase: EvalCase) => {
	const output = execFileSync(
		"opencode",
		[
			"run",
			"--format",
			"json",
			"--model",
			OPENCODE_DEFAULT_MODEL,
			buildOpencodeEvalPrompt(evalCase)
		],
		{
			cwd: repoRoot,
			encoding: "utf8",
			timeout: OPENCODE_TIMEOUT_MS,
			maxBuffer: 20 * 1024 * 1024
		}
	)

	const events = parseOpencodeEvents(output)
	const answer = events
		.filter((event): event is OpencodeTextEvent => event.type === "text")
		.map((event) => event.part?.text?.trim() ?? "")
		.filter((text) => text.length > 0)
		.join("\n")
	const toolUses = events.filter(
		(event): event is OpencodeToolUseEvent => event.type === "tool_use"
	)
	const toolNames = toolUses.map((event) => event.part?.tool ?? "")
	const readPaths = toolUses
		.filter((event) => event.part?.tool === "read")
		.map((event) => event.part?.state?.input?.filePath)
		.filter((filePath): filePath is string => Boolean(filePath))
		.map(normalizePath)

	return {
		answer,
		readPaths,
		toolNames
	}
}

const assertEvalCaseOnce = (evalCase: EvalCase) => {
	const { answer, readPaths, toolNames } = runOpencodeEvalCase(evalCase)
	const usedSkillRoot = readPaths.some((filePath) => isSkillRootRead(filePath))

	assert(
		evalCase.expectedReferences.some((expectedReference) =>
			readPaths.some((filePath) => isExpectedReferenceRead(filePath, expectedReference))
		),
		`Eval ${evalCase.id} did not read any expected zeko reference file`
	)

	assert(
		answer.includes("EVAL_SKILL_USED: zeko"),
		`Eval ${evalCase.id} did not confirm zeko skill usage`
	)

	for (const expectedFragment of evalCase.expectedFragments) {
		assert(
			answer.includes(expectedFragment),
			`Eval ${evalCase.id} answer is missing expected fragment: ${expectedFragment}`
		)
	}

	const allowWebsearch = process.env.USE_ZEKO_EVAL_ALLOW_WEBSEARCH === "1"
	assert(
		allowWebsearch || !toolNames.includes("websearch"),
		`Eval ${evalCase.id} used websearch unexpectedly`
	)

	return {
		id: evalCase.id,
		usedSkillRoot,
		readPaths,
		toolNames
	}
}

const assertEvalCase = (evalCase: EvalCase) => {
	let lastError: Error | undefined

	for (let attempt = 1; attempt <= OPENCODE_ATTEMPTS; attempt += 1) {
		try {
			return assertEvalCaseOnce(evalCase)
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error))
			console.warn(
				`[use-zeko eval-opencode] ${evalCase.id} failed attempt ${attempt}/${OPENCODE_ATTEMPTS}: ${lastError.message}`
			)
		}
	}

	throw lastError ?? new Error(`Eval ${evalCase.id} failed without an error message`)
}

export const runOpencodeEvals = async () => {
	try {
		execFileSync("opencode", ["--version"], {
			cwd: repoRoot,
			encoding: "utf8"
		})
	} catch {
		throw new Error("opencode is required for eval-opencode but was not found in PATH")
	}

	assert(
		fs.existsSync(INSTALLED_SKILL_PATH),
		"Missing .agents/skills/zeko/SKILL.md dogfood symlink"
	)
	assert(fs.existsSync(INSTALLED_REFERENCES_DIR), "Missing .agents/skills/zeko/references")

	const caseFilter = process.env.USE_ZEKO_EVAL_CASE
	const selectedCases = evalCases.filter((evalCase) => !caseFilter || evalCase.id === caseFilter)
	assert(selectedCases.length > 0, `No eval cases matched USE_ZEKO_EVAL_CASE=${caseFilter}`)

	for (const evalCase of selectedCases) {
		const result = assertEvalCase(evalCase)
		console.log(
			`[use-zeko eval-opencode] ${result.id} passed (root-read=${result.usedSkillRoot ? "yes" : "no"}) with reads: ${result.readPaths
				.map((filePath) => path.relative(repoRoot, filePath))
				.join(", ")}`
		)
	}
}

export const runCheck = async () => {
	await runValidation()
}
