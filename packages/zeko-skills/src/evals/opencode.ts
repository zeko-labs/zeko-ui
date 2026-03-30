import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { referencesDir, repoRoot, skillPath } from "../config.js"
import { type EvalCase, evalCases } from "../spec.js"
import { assert, endsWithPathSegment, normalizePath } from "../utils.js"

const opencodeTimeoutMs = Number(process.env.USE_ZEKO_EVAL_TIMEOUT_MS ?? "180000")
const opencodeAttempts = Number(process.env.USE_ZEKO_EVAL_ATTEMPTS ?? "3")

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
				name?: string
			}
			output?: string
		}
	}
}

type OpencodeEvent = OpencodeTextEvent | OpencodeToolUseEvent | { type: string }

const isSkillRootRead = (filePath: string) =>
	endsWithPathSegment(filePath, path.join(".agents", "skills", "zeko", "SKILL.md")) ||
	endsWithPathSegment(filePath, path.join(".claude", "skills", "zeko", "SKILL.md")) ||
	endsWithPathSegment(filePath, path.join("packages", "zeko-skills", "zeko", "SKILL.md"))

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
		path.join("packages", "zeko-skills", "zeko", "references", referenceFile)
	) ||
	endsWithPathSegment(filePath, path.join("references", referenceFile))

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
	const args = ["run", "--format", "json"]
	const model = process.env.USE_ZEKO_EVAL_MODEL?.trim()

	if (model) {
		args.push("--model", model)
	}

	args.push(buildOpencodeEvalPrompt(evalCase))

	const output = execFileSync("opencode", args, {
		cwd: repoRoot,
		encoding: "utf8",
		timeout: opencodeTimeoutMs,
		maxBuffer: 20 * 1024 * 1024
	})

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
	const skillOutputs = toolUses
		.filter((event) => event.part?.tool === "skill" && event.part?.state?.input?.name === "zeko")
		.map((event) => event.part?.state?.output ?? "")
	const readPaths = toolUses
		.filter((event) => event.part?.tool === "read")
		.map((event) => event.part?.state?.input?.filePath)
		.filter((filePath): filePath is string => Boolean(filePath))
		.map(normalizePath)

	return {
		answer,
		readPaths,
		skillOutputs,
		toolNames
	}
}

const assertEvalCaseOnce = (evalCase: EvalCase) => {
	const { answer, readPaths, skillOutputs, toolNames } = runOpencodeEvalCase(evalCase)
	const usedSkillTool = skillOutputs.length > 0
	const usedSkillRoot = readPaths.some((filePath) => isSkillRootRead(filePath))
	const usedExpectedReference = evalCase.expectedReferences.some((expectedReference) =>
		readPaths.some((filePath) => isExpectedReferenceRead(filePath, expectedReference))
	)

	assert(usedSkillTool || usedSkillRoot, `Eval ${evalCase.id} did not load the zeko skill`)

	assert(
		usedExpectedReference || usedSkillTool,
		`Eval ${evalCase.id} did not load any expected zeko reference context`
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
		usedSkillTool,
		usedSkillRoot,
		readPaths
	}
}

const assertEvalCase = (evalCase: EvalCase) => {
	let lastError: Error | undefined

	for (let attempt = 1; attempt <= opencodeAttempts; attempt += 1) {
		try {
			return assertEvalCaseOnce(evalCase)
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error))
			console.warn(
				`[zeko-skills eval-opencode] ${evalCase.id} failed attempt ${attempt}/${opencodeAttempts}: ${lastError.message}`
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
		throw new Error("opencode is required for zeko-skills eval-opencode but was not found in PATH")
	}

	assert(fs.existsSync(skillPath), "Missing zeko/SKILL.md")
	assert(fs.existsSync(referencesDir), "Missing zeko/references")

	const caseFilter = process.env.USE_ZEKO_EVAL_CASE
	const selectedCases = evalCases.filter((evalCase) => !caseFilter || evalCase.id === caseFilter)

	assert(selectedCases.length > 0, `No eval cases matched USE_ZEKO_EVAL_CASE=${caseFilter}`)

	for (const evalCase of selectedCases) {
		const result = assertEvalCase(evalCase)
		console.log(
			`[zeko-skills eval-opencode] ${result.id} passed (skill-tool=${result.usedSkillTool ? "yes" : "no"}, root-read=${result.usedSkillRoot ? "yes" : "no"}) with reads: ${result.readPaths
				.map((filePath) => path.relative(repoRoot, filePath))
				.join(", ")}`
		)
	}
}
