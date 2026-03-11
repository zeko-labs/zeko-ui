import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
	type EndpointCheck,
	type EvalCase,
	type SourceFileCheck,
	endpointChecks,
	evalCases,
	packageRoot,
	repoRoot,
	requiredReferences,
	skippedExternalLinkChecks,
	sourceFileChecks
} from "./spec.js"

const SKILL_PATH = path.join(packageRoot, "SKILL.md")
const REFERENCES_DIR = path.join(packageRoot, "references")
const requiredReferenceSet = new Set<string>(requiredReferences)

const tokenize = (value: string) =>
	Array.from(
		new Set(
			value
				.toLowerCase()
				.split(/[^a-z0-9]+/g)
				.map((part) => part.trim())
				.filter((part) => part.length >= 3)
		)
	)

const getReferenceFiles = () =>
	fs
		.readdirSync(REFERENCES_DIR, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right))

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

export const validateStructure = () => {
	assert(fs.existsSync(SKILL_PATH), "Missing package root SKILL.md")
	assert(fs.existsSync(REFERENCES_DIR), "Missing references directory")

	const skill = fs.readFileSync(SKILL_PATH, "utf8")
	const actualReferences = getReferenceFiles()

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

const validateSourceFileCheck = ({
	path: relativePath,
	description,
	mustNotContain,
	optional
}: SourceFileCheck) => {
	const absolutePath = path.resolve(repoRoot, relativePath)

	if (!fs.existsSync(absolutePath)) {
		assert(optional === true, `Missing mapped source file: ${relativePath} (${description})`)
		return
	}

	if (!mustNotContain || mustNotContain.length === 0) {
		return
	}

	const content = fs.readFileSync(absolutePath, "utf8")
	for (const marker of mustNotContain) {
		assert(
			!content.includes(marker),
			`Mapped source file contains stale marker ${marker}: ${relativePath}`
		)
	}
}

export const validateSourceFiles = () => {
	for (const check of sourceFileChecks) {
		validateSourceFileCheck(check)
	}

	const redirects = readRepoFile("apps/docs/content/public/_redirects").content
	assert(redirects.includes("/llms.txt"), "Docs redirects do not include /llms.txt")
	assert(redirects.includes("/llms-full.txt"), "Docs redirects do not include /llms-full.txt")
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

const collectMarkdownFiles = () => {
	const files: string[] = []
	const stack = [packageRoot]

	while (stack.length > 0) {
		const current = stack.pop()
		if (!current) {
			continue
		}

		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const entryPath = path.join(current, entry.name)
			if (entry.isDirectory()) {
				if (entry.name === "dist" || entry.name === "node_modules") {
					continue
				}
				stack.push(entryPath)
				continue
			}

			if (entry.isFile() && entry.name.endsWith(".md")) {
				files.push(entryPath)
			}
		}
	}

	return files.sort((left, right) => left.localeCompare(right))
}

const isGraphQlEndpoint = (url: string) =>
	url.endsWith("/graphql") ||
	url.includes("gateway.mina.devnet.zeko.io") ||
	url.includes("gateway.mina.archive.devnet.zeko.io") ||
	url === "https://testnet.zeko.io" ||
	url === "https://devnet.zeko.io/graphql"

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
	getReferenceFiles().map((referenceFile) => ({
		referenceFile,
		content: readReferenceContent(referenceFile),
		tokens: tokenize(`${referenceFile}\n${readReferenceContent(referenceFile)}`)
	}))

const scoreEvalCase = (evalCase: EvalCase) => {
	const promptTokens = tokenize(evalCase.prompt)
	const promptText = evalCase.prompt.toLowerCase()

	return loadReferenceCorpus()
		.map((reference) => {
			const sharedTokens = promptTokens.filter((token) => reference.tokens.includes(token))
			const referenceText = `${reference.referenceFile}\n${reference.content}`.toLowerCase()
			let score = sharedTokens.length

			if (promptText.includes("tmina") && referenceText.includes("faucet")) {
				score += 3
			}

			if (
				(promptText.includes("wallet") || promptText.includes("faucet")) &&
				(reference.referenceFile === "10-users.md" || reference.referenceFile === "40-faucet.md")
			) {
				score += 2
			}

			if (
				(promptText.includes("bridge") ||
					promptText.includes("deposit") ||
					promptText.includes("withdrawal")) &&
				reference.referenceFile === "30-bridge.md"
			) {
				score += 3
			}

			if (
				(promptText.includes("endpoint") || promptText.includes("graphql")) &&
				reference.referenceFile === "60-networks-and-endpoints.md"
			) {
				score += 3
			}

			if (
				(promptText.includes("o1js") || promptText.includes("zkapp")) &&
				(reference.referenceFile === "20-build-on-zeko.md" ||
					reference.referenceFile === "50-o1js-and-tooling.md")
			) {
				score += 3
			}

			if (
				(promptText.includes("sequencer") ||
					promptText.includes("da layer") ||
					promptText.includes("verifier") ||
					promptText.includes("protocol")) &&
				reference.referenceFile === "70-architecture-and-protocol.md"
			) {
				score += 4
			}

			return {
				referenceFile: reference.referenceFile,
				score,
				content: reference.content
			}
		})
		.sort(
			(left, right) =>
				right.score - left.score || left.referenceFile.localeCompare(right.referenceFile)
		)
}

export const runEvals = () => {
	for (const evalCase of evalCases) {
		const ranked = scoreEvalCase(evalCase)
		const topReferences = ranked.slice(0, 4).map((entry) => entry.referenceFile)
		const combinedContent = ranked
			.slice(0, Math.max(4, evalCase.expectedReferences.length))
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
	validateSourceFiles()
	validateEndpoints()
	await validateExternalLinks()
}

export const runCheck = async () => {
	await runValidation()
	runEvals()
}
