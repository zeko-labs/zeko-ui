import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { config } from "../../design/src/index.ts"
import { cssForge } from "../../layer/.cssforge/output.ts"

type CssforgeLeaf = {
	key: string
	value: string
	variable: string
}

type TokenLeaf = {
	value: string
	type?: string
	$tier: "primitive" | "semantic"
	$reference?: string
	attributes: {
		cssVariable: string
		cssforgePath: string
		resolvedValue: string
		references?: string[]
	}
}

type TokenTree = {
	[key: string]: TokenTree | TokenLeaf
}

const currentDir = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(currentDir, "../.musea/cssforge-tokens.json")

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value)

const isCssforgeLeaf = (value: unknown): value is CssforgeLeaf =>
	isRecord(value) &&
	typeof value.key === "string" &&
	typeof value.value === "string" &&
	typeof value.variable === "string"

const kebab = (value: string) =>
	value
		.replace(/_/g, "-")
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.toLowerCase()

const splitTokenSegment = (segment: string) => segment.split("@").map(kebab)

const normalizePath = (path: string): string[] => {
	const segments = path.split(".")
	const [moduleName] = segments

	if (moduleName === "palette" || moduleName === "gradients" || moduleName === "theme") {
		return [moduleName, ...segments.slice(1).filter((segment) => segment !== "value")].flatMap(
			splitTokenSegment
		)
	}

	if (moduleName === "typography_fluid") {
		return ["typography", "fluid", ...segments.slice(1).flatMap(splitTokenSegment)]
	}

	if (moduleName === "typography") {
		return [
			"typography",
			...segments
				.slice(1)
				.filter((segment) => segment !== "value")
				.flatMap(splitTokenSegment)
		]
	}

	if (moduleName === "spacing") {
		return [
			"spacing",
			...segments
				.slice(1)
				.filter((segment) => segment !== "value")
				.flatMap(splitTokenSegment)
		]
	}

	if (moduleName === "spacing_fluid") {
		return ["spacing", "fluid", ...segments.slice(1).flatMap(splitTokenSegment)]
	}

	if (moduleName === "primitives") {
		return [
			"primitives",
			...segments
				.slice(1)
				.filter((segment) => segment !== "value")
				.flatMap(splitTokenSegment)
		]
	}

	return segments.flatMap(splitTokenSegment)
}

const normalizePathString = (path: string) => normalizePath(path).join(".")

const flattenCssforge = (value: unknown, path: string[] = []): Map<string, CssforgeLeaf> => {
	const entries = new Map<string, CssforgeLeaf>()

	if (isCssforgeLeaf(value)) {
		entries.set(normalizePathString(path.join(".")), value)
		return entries
	}

	if (!isRecord(value)) {
		return entries
	}

	for (const [key, child] of Object.entries(value)) {
		for (const [childPath, childValue] of flattenCssforge(child, [...path, key])) {
			entries.set(childPath, childValue)
		}
	}

	return entries
}

const referencedVariableNames = (value: string) =>
	Array.from(value.matchAll(/var\(--([^)]+)\)/g), ([, name]) => name).filter(
		(name): name is string => Boolean(name)
	)

const referencesForValue = (value: string, variables?: Record<string, string>) => {
	const references = referencedVariableNames(value)
		.map((name) => variables?.[name])
		.filter((reference): reference is string => Boolean(reference))
		.map(normalizePathString)

	return Array.from(new Set(references))
}

const setToken = (tree: TokenTree, path: string[], token: TokenLeaf) => {
	const [head, ...tail] = path
	if (!head) {
		return
	}

	if (tail.length === 0) {
		tree[head] = token
		return
	}

	const current = tree[head]
	const branch = isRecord(current) && !isCssforgeLeaf(current) ? (current as TokenTree) : {}
	tree[head] = branch
	setToken(branch, tail, token)
}

const inferTokenType = (path: string, value: string) => {
	if (path.startsWith("palette.") || path.startsWith("theme.")) {
		return "color"
	}

	if (path.startsWith("gradients.") || value.includes("gradient(")) {
		return "gradient"
	}

	if (path.startsWith("spacing.")) {
		return "spacing"
	}

	if (path.startsWith("typography.")) {
		return "typography"
	}

	if (/font-size|radius|padding|width|height/i.test(path)) {
		return "dimension"
	}

	return undefined
}

const withReferences = (references: string[]) => ({
	tier: references.length > 0 ? ("semantic" as const) : ("primitive" as const),
	reference: references[0],
	references: references.length > 0 ? references : undefined
})

const referenceMapFromConfig = () => {
	const references = new Map<string, string[]>()

	for (const [gradientName, gradient] of Object.entries(config.colors?.gradients?.value ?? {})) {
		for (const [variantName, gradientValue] of Object.entries(gradient.value)) {
			const path = normalizePathString(`gradients.${gradientName}.${variantName}`)
			references.set(path, referencesForValue(gradientValue.value, gradientValue.variables))
		}
	}

	for (const [themeName, theme] of Object.entries(config.colors?.theme?.value ?? {})) {
		for (const [groupName, group] of Object.entries(theme)) {
			for (const [variantName, value] of Object.entries(group.value)) {
				const path = normalizePathString(`theme.${themeName}.${groupName}.${variantName}`)
				references.set(path, referencesForValue(value, group.variables))
			}
		}
	}

	for (const [primitiveName, primitive] of Object.entries(config.primitives ?? {})) {
		for (const [variantName, primitiveValue] of Object.entries(primitive.value)) {
			for (const [propertyName, value] of Object.entries(primitiveValue.value)) {
				const path = normalizePathString(
					`primitives.${primitiveName}.${variantName}.${propertyName}`
				)
				references.set(path, referencesForValue(value, primitiveValue.variables))
			}
		}
	}

	return references
}

const generateTokens = () => {
	const tokens: TokenTree = {}
	const references = referenceMapFromConfig()

	for (const [path, leaf] of flattenCssforge(cssForge)) {
		const tokenReferences = references.get(path) ?? []
		const { tier, reference } = withReferences(tokenReferences)
		const token: TokenLeaf = {
			value: `var(${leaf.key})`,
			type: inferTokenType(path, leaf.value),
			$tier: tier,
			attributes: {
				cssVariable: leaf.key,
				cssforgePath: path,
				resolvedValue: leaf.value,
				references: tokenReferences.length > 0 ? tokenReferences : undefined
			}
		}

		if (reference) {
			token.$reference = reference
		}

		setToken(tokens, path.split("."), token)
	}

	return tokens
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(generateTokens(), null, 2)}\n`, "utf8")
console.log(`Generated Musea cssforge tokens at ${outputPath}`)
