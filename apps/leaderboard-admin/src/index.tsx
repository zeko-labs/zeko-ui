/* @refresh reload */
import { render } from "solid-js/web"
import "@picocss/pico"
import App from "./App.tsx"

const root = document.getElementById("root")

if (root) {
	render(() => <App />, root)
} else {
	// In unexpected environments where 'root' is missing, fail loudly in dev
	// or skip rendering in non-browser contexts.
	// eslint-disable-next-line no-console
	console.warn("Root element not found: skipping render")
}
