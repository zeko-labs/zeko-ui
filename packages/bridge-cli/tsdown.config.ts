import { defineConfig } from "tsdown"

export default defineConfig({
	entry: ["./src/cli.ts", "./src/index.ts"],
	platform: "node",
	dts: true,
	tsconfig: "./tsconfig.build.json",
	external: ["o1js"]
})
