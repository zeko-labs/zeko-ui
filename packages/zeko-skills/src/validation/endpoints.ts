import { type EndpointCheck, endpointChecks } from "../spec.js"
import { assert, readRepoFile } from "../utils.js"

const validateEndpointCheck = ({
	name,
	documentedUrl,
	documentedSources,
	deployedSources = []
}: EndpointCheck) => {
	for (const relativePath of documentedSources) {
		const { content } = readRepoFile(relativePath)
		assert(
			content.includes(documentedUrl),
			`Endpoint ${name} missing documented URL from ${relativePath}: ${documentedUrl}`
		)
	}

	const deployedHostname = new URL(documentedUrl).hostname
	for (const relativePath of deployedSources) {
		const { content } = readRepoFile(relativePath)
		assert(
			content.includes(deployedHostname),
			`Endpoint ${name} deployed route missing from ${relativePath}: ${deployedHostname}`
		)
	}
}

export const validateEndpoints = () => {
	for (const endpointCheck of endpointChecks) {
		validateEndpointCheck(endpointCheck)
	}
}
