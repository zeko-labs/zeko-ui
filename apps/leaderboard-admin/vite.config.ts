import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

export default defineConfig({
	plugins: [solid()],
	server: {
		port: 3070
	},
	oxc: {
		jsx: "preserve"
	},
	optimizeDeps: {
		rolldownOptions: {
			jsx: "preserve"
		}
	}
})
