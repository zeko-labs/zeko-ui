import postcssGlobalData from "@csstools/postcss-global-data"
import vize from "@vizejs/vite-plugin"
import { musea } from "@vizejs/vite-plugin-musea"
import postcssPresetEnv from "postcss-preset-env"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [
		vize(),
		musea({
			include: ["src/**/*.art.vue", "../layer/app/components/**/*.vue"],
			basePath: "/__musea__",
			tokensPath: ".musea/cssforge-tokens.json",
			previewCss: [
				"../layer/app/assets/styles/cssforge.css",
				"../layer/app/assets/styles/layer.css",
				"src/styles/musea.css"
			],
			previewSetup: "src/musea.preview.ts"
		})
	],
	css: {
		postcss: {
			plugins: [
				postcssGlobalData({
					files: ["../layer/app/assets/styles/queries.css"]
				}),
				postcssPresetEnv({ browsers: "baseline widely available" })
			]
		}
	}
})
