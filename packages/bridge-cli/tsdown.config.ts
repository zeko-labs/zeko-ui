import { defineConfig } from "tsdown"

export default defineConfig({
	entry: {
		cli: "./src/cli.ts",
		"create-wallet-env": "./scripts/create-wallet-env.ts"
	},
	platform: "node",
	dts: false,
	outputOptions: {
		inlineDynamicImports: true
	},
	tsconfig: "./tsconfig.build.json",
	external: ["o1js"]
})
