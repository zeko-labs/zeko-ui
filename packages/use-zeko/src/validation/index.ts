import { validateEndpoints } from "./endpoints.js"
import { validateExternalLinks } from "./external-links.js"
import { validateSelfContainedMarkdown, validateStructure } from "./markdown.js"

export const runValidation = async () => {
	validateStructure()
	validateSelfContainedMarkdown()
	validateEndpoints()
	await validateExternalLinks()
}
