import { onUnmounted, ref } from "vue"

interface TurnstileWindow extends Window {
	turnstile?: {
		render: (
			element: string | HTMLElement,
			options: {
				sitekey: string
				callback: (token: string) => void
				"error-callback"?: () => void
				theme?: "light" | "dark" | "auto"
				size?: "normal" | "compact"
			}
		) => string
		reset: (widgetId: string) => void
		remove: (widgetId: string) => void
		execute: (widgetId: string) => void
	}
}

export function useTurnstile(siteKey: string) {
	const token = ref<string>("")
	const widgetId = ref<string>("")
	const isExecuting = ref(false)

	const { load } = useScript<{ turnstile: TurnstileWindow["turnstile"] }>(
		"https://challenges.cloudflare.com/turnstile/v0/api.js",
		{
			use: () => ({ turnstile: (window as TurnstileWindow).turnstile })
		}
	)

	const execute = async (): Promise<string> => {
		// Ensure script is loaded
		await load()

		return new Promise((resolve, reject) => {
			const turnstile = (window as TurnstileWindow).turnstile
			if (!turnstile) {
				reject(new Error("Turnstile not loaded"))
				return
			}

			isExecuting.value = true

			// For invisible mode, we render to a hidden container
			const container = document.createElement("div")
			container.style.display = "none"
			document.body.appendChild(container)

			const cleanup = () => {
				isExecuting.value = false
				document.body.removeChild(container)
			}

			widgetId.value = turnstile.render(container, {
				sitekey: siteKey,
				callback: (responseToken: string) => {
					token.value = responseToken
					cleanup()
					resolve(responseToken)
				},
				"error-callback": () => {
					cleanup()
					reject(new Error("Turnstile verification failed"))
				},
				size: "normal"
			})

			// Execute immediately for invisible mode
			turnstile.execute(widgetId.value)
		})
	}

	const reset = () => {
		const turnstile = (window as TurnstileWindow).turnstile
		if (turnstile && widgetId.value) {
			turnstile.reset(widgetId.value)
			token.value = ""
		}
	}

	onUnmounted(() => {
		const turnstile = (window as TurnstileWindow).turnstile
		if (turnstile && widgetId.value) {
			turnstile.remove(widgetId.value)
		}
	})

	return { token, isExecuting, execute, reset }
}
