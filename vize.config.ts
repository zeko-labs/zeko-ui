import { defineConfig } from "vize"

export default defineConfig({
	compiler: {
		sourceMap: true,
		vapor: false,
		customRenderer: false,
		templateSyntax: "standard"
	},
	vite: {
		scanPatterns: [
			"apps/bridge-ui/app/**/*.vue",
			"apps/faucet-ui/app/**/*.vue",
			"apps/leaderboard-ui/app/**/*.vue",
			"packages/layer/app/**/*.vue",
			"packages/layer/playground/**/*.vue",
			"packages/musea/src/**/*.vue"
		],
		ignorePatterns: ["**/node_modules/**", "**/.nuxt/**", "**/.output/**", "**/dist/**"]
	},
	musea: {
		include: ["packages/musea/src/**/*.art.vue"],
		exclude: ["**/node_modules/**", "**/.nuxt/**", "**/.output/**", "**/dist/**"],
		basePath: "/__musea__",
		storybookCompat: false,
		inlineArt: false
	}
})
