type ThemeValue = string | number | string[] | number[] | readonly string[]

interface ThemeValueMap {
	[key: string]: ThemeValue
}

interface ThemeConfig {
	[token: string]: ThemeValueMap | ThemeConfig | ThemeValue
}

type ThemeVariableValueMap<Map> = {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	[key in keyof Map]: Map[key] extends Record<string, any>
		? ThemeVariableValueMap<Map[key]>
		: { variable: string; value: Map[key] }
}

type ThemeVariables<Theme> = {
	[token in keyof Theme]: ThemeVariableValueMap<Theme[token]>
}

type Theme<Shape> = {
	css: {
		string: string
		properties: Array<[string, string]>
	}
	config: ThemeVariables<Shape>
}

export function createTheme<Shape extends ThemeConfig>(config: Shape): Theme<Shape> {
	const cssEntries = generateCSSEntries(config)
	const variables = createThemeVariables(config)

	const theme = {
		css: {
			string: cssEntries.flatMap(({ key, value }) => `${key}: ${value};`).join("\n"),
			properties: cssEntries.map(({ key, value }) => [key, value]) as Array<[string, string]>
		},
		config: variables
	}

	return theme
}

function generateCSSEntries<T extends ThemeConfig>(
	config: T
): Array<{ key: string; value: string | string[] | number[] }> {
	return Object.keys(config).flatMap((configKey) => {
		const value = config[configKey]
		if (Array.isArray(value)) {
			return { key: value.join(","), value }
		}
		if (typeof value === "object") {
			return createCSSEntries(value as ThemeConfig | ThemeValueMap, configKey)
		}

		return { key: toCSSProperty(configKey, "") as string, value: toCSSValue(value) }
	})
}

function createCSSEntries<T extends ThemeConfig | ThemeValueMap>(
	map: T,
	prefix = ""
): Array<{ key: string; value: string }> {
	return Object.keys(map)
		.map((prop) => {
			const value = map[prop]
			if (typeof value === "string" || typeof value === "number") {
				const key = toCSSProperty(prop, prefix)
				return { key, value: toCSSValue(value) }
			}
			if (Array.isArray(value)) {
				return value
			}
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			return createCSSEntries(value as ThemeConfig | ThemeValueMap, `${prefix}-${prop}`) as any
		})
		.flat(Number.POSITIVE_INFINITY)
}

function createThemeVariables<T extends ThemeConfig | ThemeValueMap>(
	config: T,
	prefix = ""
): ThemeVariables<T> {
	const variables = Object.create(null)
	for (const key in config) {
		const v = config[key]
		if (Array.isArray(v)) {
			continue
		}
		if (typeof v !== "object") {
			const variableName = toCSSVariable(key, prefix)
			variables[key] = {
				variable: variableName,
				value: v
			}
		} else {
			variables[key] = createThemeVariables(
				v as ThemeConfig | ThemeValueMap,
				prefix === "" ? key : `${prefix}-${key}`
			)
		}
	}

	return variables
}

function toCSSVariable<K extends string, P extends string>(key: K, prefix: P) {
	return `var(${toCSSProperty(key, prefix)})` as const
}

function camelCaseToHypen<S extends string>(str: S) {
	return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
}

function toCSSProperty<K extends string, P extends string>(key: K, prefix: P) {
	if (prefix === "") {
		return `--${camelCaseToHypen(key)}` as `--${K}`
	}

	return `--${`${prefix}-${camelCaseToHypen(key)}`}` as `--${P}-${K}`
}

function toCSSValue(value: string | number) {
	if (typeof value === "string") {
		return value
	}

	return `${value}px`
}
