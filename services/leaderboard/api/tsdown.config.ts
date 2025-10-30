import { defineConfig } from "tsdown"

export default defineConfig({
	entry: "module.ts",
	outDir: "dist",
	dts: true
	// This change the package.json formatting, un-comment when needed.
	// exports: {
	// 	devExports: true
	// }
})
