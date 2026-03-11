import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
	type EndpointCheck,
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
const ignoredTokens = new Set([
	"the",
	"and",
	"for",
	"with",
	"from",
	"into",
	"onto",
	"your",
	"this",
	"that",
	"what",
	"when",
	"where",
	"which",
	"should",
	"would",
	"could",
	"here",
	"there",
	"then",
	"than",
	"they",
	"them",
	"their",
	"have",
	"want",
	"need",
	"pass",
	"use"
])

const tokenize = (value: string) =>
	Array.from(
		new Set(
			value
				.toLowerCase()
				.split(/[^a-z0-9]+/g)
				.map((part) => part.trim())
				.filter((part) => part.length >= 3 && !ignoredTokens.has(part))
		)
	)

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

const readReferenceContent = (referenceFile: string) =>
	fs.readFileSync(path.join(REFERENCES_DIR, referenceFile), "utf8")

const assert = (condition: boolean, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

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

const loadReferenceCorpus = () =>
	listReferenceFiles(REFERENCES_DIR).map((referenceFile) => {
		const content = readReferenceContent(referenceFile)
		return {
			referenceFile,
			content,
			tokens: tokenize(`${referenceFile}\n${content}`)
		}
	})

const scoreEvalCase = (prompt: string) => {
	const promptTokens = tokenize(prompt)
	return loadReferenceCorpus()
		.map((reference) => ({
			referenceFile: reference.referenceFile,
			score: promptTokens.filter((token) => reference.tokens.includes(token)).length,
			content: reference.content
		}))
		.sort(
			(left, right) =>
				right.score - left.score || left.referenceFile.localeCompare(right.referenceFile)
		)
}

export const runEvals = () => {
	for (const evalCase of evalCases) {
		const ranked = scoreEvalCase(evalCase.prompt)
		const topReferences = ranked.slice(0, 4).map((entry) => entry.referenceFile)
		const combinedContent = ranked
			.slice(0, 4)
			.map((entry) => entry.content)
			.join("\n")

		for (const expectedReference of evalCase.expectedReferences) {
			assert(
				topReferences.includes(expectedReference),
				`Eval ${evalCase.id} did not rank ${expectedReference} in the top references`
			)
		}

		for (const expectedFragment of evalCase.expectedFragments) {
			assert(
				combinedContent.includes(expectedFragment),
				`Eval ${evalCase.id} is missing expected fragment: ${expectedFragment}`
			)
		}
	}
}

export const runValidation = async () => {
	validateStructure()
	validateSelfContainedMarkdown()
	validateEndpoints()
	await validateExternalLinks()
}

export const runCheck = async () => {
	await runValidation()
	runEvals()
}
