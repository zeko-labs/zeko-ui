import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const CONTENT_DIR = fileURLToPath(new URL("../content", import.meta.url))
const NETWORK_LABEL_COMPONENT = fileURLToPath(
	new URL("../.vitepress/theme/components/NetworkLabel.vue", import.meta.url)
)

async function walkMarkdown(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true, recursive: true })
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => join(entry.parentPath ?? entry.path, entry.name))
}

describe("network labels", () => {
	it("does not expose internal Zeko-M labels in docs content", async () => {
		const markdownFiles = await walkMarkdown(CONTENT_DIR)
		const filesWithInternalLabels = await Promise.all(
			markdownFiles.map(async (file) => ({
				file,
				content: await readFile(file, "utf8")
			}))
		).then((files) => files.filter(({ content }) => content.includes("Zeko-M")))

		expect(filesWithInternalLabels.map(({ file }) => file)).toEqual([])
	})

	it("renders docs network labels through the shared helper", async () => {
		const component = await readFile(NETWORK_LABEL_COMPONENT, "utf8")

		expect(component).toContain("formatUserFacingNetworkLabel")
	})
})
