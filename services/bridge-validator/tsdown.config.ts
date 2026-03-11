import { defineConfig } from "tsdown"

export default defineConfig({
	entry: {
		index: "src/index.ts",
		server: "src/server.ts"
	},
	outDir: "dist",
	format: ["esm"],
	exports: {
		all: true
	}
})
