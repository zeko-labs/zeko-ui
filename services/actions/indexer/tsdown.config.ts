import { defineConfig } from "tsdown"

export default defineConfig({
	entry: {
		index: "src/index.ts",
		cli: "src/cli.ts",
		"action-processing-process": "src/action-processing/process-entry.ts"
	},
	outDir: "dist",
	format: ["esm"],
	exports: {
		all: true
	}
})
