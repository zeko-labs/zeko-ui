import * as Sentry from "@sentry/nuxt"

export type AppRootErrorSurface = "vue-render" | "window-error" | "unhandledrejection"

const capturedErrors = new WeakSet<object>()

const toCaptureTarget = (error: unknown): Error | object =>
	error instanceof Error || (typeof error === "object" && error !== null)
		? error
		: new Error(String(error))

export const captureAppRootError = ({
	error,
	surface,
	route,
	component,
	info
}: {
	error: unknown
	surface: AppRootErrorSurface
	route?: string
	component?: string
	info?: string
}) => {
	if (typeof error === "object" && error !== null) {
		if (capturedErrors.has(error)) {
			return
		}

		capturedErrors.add(error)
	}

	Sentry.withScope((scope) => {
		scope.setLevel("error")
		scope.setTag("app_originated", "true")
		scope.setTag("error_surface", surface)

		if (route) {
			scope.setTag("route", route)
		}

		scope.setContext("app_root_error", {
			surface,
			route,
			component,
			info
		})

		Sentry.captureException(toCaptureTarget(error))
	})
}
