import { defineConfig } from "tsdown"

export default defineConfig({
	entry: {
		index: "./src/index.ts",
		actions: "./src/actions.ts",
		graphql: "./src/graphql/index.ts"
	},
	platform: "browser",
	dts: true,
	tsconfig: "./tsconfig.build.json"
	// This change the package.json formatting, un-comment when needed.
	// exports: {
	// 	devExports: true
	// }
})
