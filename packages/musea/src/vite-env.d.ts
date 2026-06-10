declare module "*.css"

type PostcssAcceptedPlugin = {
	postcssPlugin: string
	[key: string]: unknown
}

declare module "@csstools/postcss-global-data" {
	type GlobalDataOptions = {
		files: string[]
	}

	export default function postcssGlobalData(options: GlobalDataOptions): PostcssAcceptedPlugin
}

declare module "postcss-preset-env" {
	type PresetEnvOptions = {
		browsers?: string
	}

	export default function postcssPresetEnv(options?: PresetEnvOptions): PostcssAcceptedPlugin
}
