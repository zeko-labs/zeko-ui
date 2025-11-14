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
				size?: "normal" | "compact" | "flexible"
				execution?: "render" | "execute"
				appearance?: "always" | "execute" | "interaction-only"
			}
		) => string
		reset: (widgetId: string) => void
		remove: (widgetId: string) => void
		execute: (widgetId: string) => void
		getResponse: (widgetId: string) => string | undefined
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
		await load()

		return new Promise((resolve, reject) => {
			const turnstile = (window as TurnstileWindow).turnstile
			if (!turnstile) {
				reject(new Error("Turnstile not loaded"))
				return
			}

			isExecuting.value = true

			const container = document.createElement("div")
			const containerId = `turnstile-${Date.now()}`
			container.id = containerId
			document.body.appendChild(container)

			const cleanup = () => {
				isExecuting.value = false
				if (document.body.contains(container)) {
					document.body.removeChild(container)
				}
				widgetId.value = ""
			}

			try {
				widgetId.value = turnstile.render(`#${containerId}`, {
					sitekey: siteKey,
					callback: (responseToken: string) => {
						token.value = responseToken
						cleanup()
						resolve(responseToken)
					},
					"error-callback": () => {
						cleanup()
						reject(new Error("Turnstile verification failed"))
					}
				})
			} catch (error) {
				cleanup()
				reject(error)
			}
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
