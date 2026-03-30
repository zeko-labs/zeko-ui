import * as Sentry from "@sentry/nuxt"
import type { ComponentPublicInstance } from "vue"
import { captureAppRootError } from "~/telemetry/appRootErrors"

type BridgeUiSentryWindow = Window & typeof globalThis & { __bridgeUiSentryInstalled?: boolean }

const componentName = (instance: ComponentPublicInstance | null): string | undefined => {
	const type = instance?.$?.type as { name?: string; __name?: string } | undefined
	return type?.name ?? type?.__name
}

export default defineNuxtPlugin((nuxtApp) => {
	const router = useRouter()

	const walletName = () => {
		if (window?.mina?.isAuro) return "auro"
		if (window?.mina) return "unknown"
		return "no-wallet"
	}

	const currentRoute = () => router.currentRoute.value.fullPath

	const browserWindow = window as BridgeUiSentryWindow
	if (!browserWindow.__bridgeUiSentryInstalled) {
		browserWindow.__bridgeUiSentryInstalled = true

		const originalErrorHandler = nuxtApp.vueApp.config.errorHandler
		nuxtApp.vueApp.config.errorHandler = (error, instance, info) => {
			captureAppRootError({
				error,
				surface: "vue-render",
				route: currentRoute(),
				component: componentName(instance),
				info
			})

			originalErrorHandler?.(error, instance, info)
		}

		window.addEventListener("error", (event) => {
			captureAppRootError({
				error: event.error ?? new Error(event.message),
				surface: "window-error",
				route: currentRoute(),
				info: event.message
			})
		})

		window.addEventListener("unhandledrejection", (event) => {
			captureAppRootError({
				error: event.reason,
				surface: "unhandledrejection",
				route: currentRoute(),
				info: typeof event.reason === "string" ? event.reason : undefined
			})
		})
	}

	Sentry.setTag("mina_wallet", walletName())
})
