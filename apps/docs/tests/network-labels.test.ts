import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import {
	formatUserFacingNetworkLabel,
	USER_FACING_NETWORK_LABELS,
	ZEKO_M_NETWORKS
} from "@zeko/networks"
import { describe, expect, it } from "vitest"
import { replaceNetworkLabelComponentsForLlms } from "../.vitepress/llmsNetworkLabels"

const CONTENT_DIR = fileURLToPath(new URL("../content", import.meta.url))
const NETWORK_LABEL_COMPONENT = fileURLToPath(
	new URL("../.vitepress/theme/components/NetworkLabel.vue", import.meta.url)
)
const NETWORK_LABEL_COMPONENT_TAG_PATTERN =
	/<NetworkLabel\s+network="zeko-m:(?:local|testnet|alphanet|mainnet)"\s*\/>/g
const ZEKO_M_NETWORK_ID_PATTERN = /zeko-m:(?:local|testnet|alphanet|mainnet)/g
const ZEKO_M_NETWORK_DISPLAY_LABELS = [
	ZEKO_M_NETWORKS.local,
	ZEKO_M_NETWORKS.testnet,
	ZEKO_M_NETWORKS.alphanet,
	ZEKO_M_NETWORKS.mainnet
].map((network) => formatUserFacingNetworkLabel(network))

async function walkMarkdown(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true, recursive: true })
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => join(entry.parentPath ?? entry.path, entry.name))
}

async function readMarkdownFiles(): Promise<Array<{ file: string; content: string }>> {
	const markdownFiles = await walkMarkdown(CONTENT_DIR)
	return Promise.all(
		markdownFiles.map(async (file) => ({
			file: relative(CONTENT_DIR, file),
			content: await readFile(file, "utf8")
		}))
	)
}

describe("network labels", () => {
	it("uses NetworkLabel for concrete Zeko network display labels in docs content", async () => {
		const filesWithRawNetworkLabels = (await readMarkdownFiles()).flatMap(({ file, content }) =>
			ZEKO_M_NETWORK_DISPLAY_LABELS.filter((label) => content.includes(label)).map((label) => ({
				file,
				label
			}))
		)

		expect(filesWithRawNetworkLabels).toEqual([])
	})

	it("keeps zeko-m network ids scoped to NetworkLabel props", async () => {
		const filesWithRawNetworkIds = (await readMarkdownFiles()).flatMap(({ file, content }) => {
			const withoutNetworkLabels = content.replace(NETWORK_LABEL_COMPONENT_TAG_PATTERN, "")
			return [...withoutNetworkLabels.matchAll(ZEKO_M_NETWORK_ID_PATTERN)].map(([networkId]) => ({
				file,
				networkId
			}))
		})

		expect(filesWithRawNetworkIds).toEqual([])
	})

	it("renders NetworkLabel through the shared helper", async () => {
		const component = await readFile(NETWORK_LABEL_COMPONENT, "utf8")

		expect(component).toContain("formatUserFacingNetworkLabel")
		expect(component).toContain("type DisplayNetwork")
		expect(USER_FACING_NETWORK_LABELS[ZEKO_M_NETWORKS.mainnet]).toBe(
			formatUserFacingNetworkLabel(ZEKO_M_NETWORKS.mainnet)
		)
	})

	it("expands NetworkLabel components in generated LLM docs from the shared helper", () => {
		const content = 'How do I get tMINA on <NetworkLabel network="zeko-m:testnet" />?'
		const expanded = replaceNetworkLabelComponentsForLlms(content)

		expect(expanded).toBe(
			`How do I get tMINA on ${formatUserFacingNetworkLabel(ZEKO_M_NETWORKS.testnet)}?`
		)
		expect(expanded).not.toContain("<NetworkLabel")
	})
})
