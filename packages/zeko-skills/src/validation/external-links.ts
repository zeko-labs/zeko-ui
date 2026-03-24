import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { packageRoot, referencesDir, skillPath } from "../config.js"
import { skippedExternalLinkChecks } from "../spec.js"
import { assert, listMarkdownFiles } from "../utils.js"

const collectMarkdownFiles = () => {
	const files = [skillPath, path.join(packageRoot, "README.md")]

	for (const referenceFile of listMarkdownFiles(referencesDir)) {
		files.push(path.join(referencesDir, referenceFile))
	}

	return files
}

const isGraphQlEndpoint = (url: string) =>
	url.endsWith("/graphql") ||
	url.includes("gateway.mina.devnet.zeko.io") ||
	url.includes("gateway.mina.archive.devnet.zeko.io") ||
	url === "https://testnet.zeko.io"

export const externalLinkPattern = /https:\/\/[^\s)`"'<>]+/g

const extractExternalLinks = () => {
	const urls = new Set<string>()

	for (const filePath of collectMarkdownFiles()) {
		const content = fs.readFileSync(filePath, "utf8")

		for (const match of content.matchAll(externalLinkPattern)) {
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
