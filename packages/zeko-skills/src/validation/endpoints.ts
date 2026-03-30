import { type EndpointCheck, endpointChecks } from "../spec.js"
import { assert, readRepoFile } from "../utils.js"

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
