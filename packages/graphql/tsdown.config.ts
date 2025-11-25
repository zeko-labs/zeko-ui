import { defineConfig } from "tsdown"

export default defineConfig({
	entry: [
		"./src/index.ts",
		"./src/mina.ts",
		"./src/mina-archive.ts",
		"./src/zeko.ts",
		"./src/zeko-archive.ts",
		"./src/leaderboard.ts",
		"./src/bridge-indexer.ts"
	],
	platform: "neutral",
	dts: true,
	tsconfig: "./tsconfig.build.json"
	// This change the package.json formatting, un-comment when needed.
	// exports: {
	// 	all: true,
	// 	devExports: true
	// }
})
