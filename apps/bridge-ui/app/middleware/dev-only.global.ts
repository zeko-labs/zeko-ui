export default defineNuxtRouteMiddleware(() => {
	// biome-ignore lint/complexity/useOptionalChain: <explanation>
	if (window && window.origin && new URL(window.origin).host === "bridge.zeko.io") {
		// if (true) {
		throw createError({
			statusCode: 503,
			statusMessage: "Bridge isn't ready",
			message: "We are working on this page, check back later."
		})
	}
})
