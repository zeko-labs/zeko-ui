export default defineNuxtRouteMiddleware(() => {
	if (process.env.NODE_ENV !== "development") {
		throw createError({
			statusCode: 503,
			statusMessage: "Site is under maintenance"
		})
	}
})
