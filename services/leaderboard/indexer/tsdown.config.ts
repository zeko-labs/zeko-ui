import { defineConfig } from "tsdown"

export default defineConfig({
	entry: { index: "src/index.ts", module: "src/server.ts" },
	outDir: "dist",
	format: ["esm"],
	exports: {
		all: true
	}
})
