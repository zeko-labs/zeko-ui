import { defineConfig } from "tsdown"

export default defineConfig({
	entry: ["./src/index.ts"],
	platform: "browser",
	dts: true,
	tsconfig: "./tsconfig.build.json",
	exports: {
		devExports: true
	}
})
