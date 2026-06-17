import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Plugin, ResolvedConfig } from "vite"
import { type DisplayNetwork, formatUserFacingNetworkLabel } from "@zeko/networks"

const NETWORK_LABEL_COMPONENT_PATTERN = /<NetworkLabel\s+network=(["'])(?<network>[^"']+)\1\s*\/>/g
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g

// vitepress-plugin-llms reads markdown before Vue renders docs components.
// With its default HTML stripping, NetworkLabel tags become blank text in llms-full.txt.
// With stripHTML: false, the blanks are gone but raw component tags and internal
// zeko-m:* ids are published. This postprocessor keeps docs source authored with
// NetworkLabel while expanding generated LLM artifacts through @zeko/networks.

type VitePressResolvedConfig = ResolvedConfig & {
	vitepress?: {
		outDir?: string
	}
}

export const replaceNetworkLabelComponentsForLlms = (content: string): string =>
	content.replace(
		NETWORK_LABEL_COMPONENT_PATTERN,
		(match, _quote: string, network: string | undefined) =>
			network ? formatUserFacingNetworkLabel(network as DisplayNetwork) ?? match : match
	)

const cleanLlmsArtifact = (content: string): string =>
	replaceNetworkLabelComponentsForLlms(content).replace(HTML_COMMENT_PATTERN, "")

async function collectLlmsArtifacts(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const path = join(dir, entry.name)

			if (entry.isDirectory()) {
				return collectLlmsArtifacts(path)
			}

			return entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".txt"))
				? [path]
				: []
		})
	)

	return nested.flat()
}

export const networkLabelsForLlms = (): Plugin => {
	let outDir: string | undefined

	return {
		name: "zeko-network-labels-for-llms",
		configResolved(config) {
			outDir = (config as VitePressResolvedConfig).vitepress?.outDir
		},
		async closeBundle() {
			if (!outDir) {
				return
			}

			const artifacts = await collectLlmsArtifacts(outDir)
			await Promise.all(
				artifacts.map(async (artifact) => {
					const content = await readFile(artifact, "utf8")
					const cleaned = cleanLlmsArtifact(content)

					if (cleaned !== content) {
						await writeFile(artifact, cleaned)
					}
				})
			)
		}
	}
}
