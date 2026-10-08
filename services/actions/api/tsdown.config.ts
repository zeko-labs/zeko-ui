import { defineConfig } from "tsdown"

export default defineConfig([
	{
		entry: "module.ts",
		outDir: "dist",
		dts: true
		// This change the package.json formatting, un-comment when needed.
		// exports: {
		// 	devExports: true
		// }
	},
	{
		// Standalone Node.js server (src/standalone.ts); the Worker keeps
		// bundling src/index.ts through wrangler. No declarations: nothing
		// imports this entry.
		entry: { standalone: "src/standalone.ts" },
		outDir: "dist",
		platform: "node",
		dts: false
	}
])
