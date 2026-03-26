import { validateClawhubMetadata } from "./clawhub.js"
import { validateEndpoints } from "./endpoints.js"
import { validateExternalLinks } from "./external-links.js"
import { validateSelfContainedMarkdown, validateStructure } from "./markdown.js"
import { validatePublicMirrorSurface } from "./public-surface.js"

export const runValidation = async () => {
	validateStructure()
	validateClawhubMetadata()
	validateSelfContainedMarkdown()
	validateEndpoints()
	validatePublicMirrorSurface()
	await validateExternalLinks()
}
