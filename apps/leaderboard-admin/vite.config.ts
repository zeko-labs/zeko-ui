import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

export default defineConfig({
	plugins: [solid()],
	oxc: {
		jsx: "preserve"
	},
	optimizeDeps: {
		rolldownOptions: {
			jsx: "preserve"
		}
	}
})
