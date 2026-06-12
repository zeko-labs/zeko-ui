import { defineConfig } from "tsdown"

export default defineConfig({
	entry: ["./src/index.ts"],
	platform: "neutral",
	dts: true,
	tsconfig: "./tsconfig.build.json"
})
