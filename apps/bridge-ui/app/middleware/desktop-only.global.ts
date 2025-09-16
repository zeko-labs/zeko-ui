export default defineNuxtRouteMiddleware((to) => {
	if (import.meta.server) return
	const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
	if (isMobile) {
		if (to.path.startsWith("/unsupported")) return
		return navigateTo({ path: "/unsupported", query: { r: to.fullPath } }, { replace: true })
	}
	if (to.path === "/unsupported") return navigateTo({ path: "/" }, { replace: true })
})
