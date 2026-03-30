import * as Sentry from "@sentry/nuxt"

export type AppRootErrorSurface = "vue-render" | "window-error" | "unhandledrejection"

const capturedObjects = new WeakSet<object>()
const capturedPrimitives = new Set<string>()

const toCaptureTarget = (error: unknown): Error | object =>
	error instanceof Error || (typeof error === "object" && error !== null)
		? error
		: new Error(String(error))

const primitiveCaptureKey = (error: unknown): string | null =>
	typeof error === "object" && error !== null ? null : String(error)

const isDuplicateCapture = (error: unknown): boolean => {
	const primitiveKey = primitiveCaptureKey(error)
	if (primitiveKey !== null) {
		if (capturedPrimitives.has(primitiveKey)) return true
		capturedPrimitives.add(primitiveKey)
		return false
	}

	const objectError = error as object
	if (capturedObjects.has(objectError)) return true
	capturedObjects.add(objectError)
	return false
}

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
	if (isDuplicateCapture(error)) return

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
