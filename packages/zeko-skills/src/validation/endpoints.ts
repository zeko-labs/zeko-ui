import { type EndpointCheck, endpointChecks } from "../spec.js"
import { assert, readRepoFile } from "../utils.js"

const validateEndpointCheck = ({ name, expected, sources }: EndpointCheck) => {
	const expectedEndpoints = Array.isArray(expected) ? expected : [expected]
	for (const relativePath of sources) {
		const { content } = readRepoFile(relativePath)
		assert(
			expectedEndpoints.some((endpoint) => content.includes(endpoint)),
			`Endpoint ${name} missing from ${relativePath}: ${expectedEndpoints.join(" or ")}`
		)
	}
}

export const validateEndpoints = () => {
	for (const endpointCheck of endpointChecks) {
		validateEndpointCheck(endpointCheck)
	}
}
