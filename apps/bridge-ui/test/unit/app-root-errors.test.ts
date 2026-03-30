import { beforeEach, describe, expect, it, vi } from "vitest"

const captureException = vi.hoisted(() => vi.fn())

const withScope = vi.hoisted(() =>
	vi.fn(
		(
			callback: (scope: {
				setLevel: (level: string) => void
				setTag: (key: string, value: string) => void
				setContext: (key: string, value: Record<string, unknown>) => void
			}) => void
		) => {
			const tags = new Map<string, string>()
			const contexts = new Map<string, Record<string, unknown>>()
			let level = ""

			callback({
				setLevel(nextLevel) {
					level = nextLevel
				},
				setTag(key, value) {
					tags.set(key, value)
				},
				setContext(key, value) {
					contexts.set(key, value)
				}
			})

			return { level, tags, contexts }
		}
	)
)

vi.mock("@sentry/nuxt", () => ({
	withScope,
	captureException
}))

import { captureAppRootError } from "../../app/telemetry/appRootErrors"

describe("captureAppRootError", () => {
	beforeEach(() => {
		captureException.mockClear()
		withScope.mockClear()
	})

	it("tags app-originated root errors with the requested surface", () => {
		captureAppRootError({
			error: new Error("boom"),
			surface: "vue-render",
			route: "/bridge",
			component: "BridgeOperations",
			info: "render function"
		})

		expect(captureException).toHaveBeenCalledTimes(1)

		const [{ level, tags, contexts }] = withScope.mock.results.at(-1)?.value
			? [withScope.mock.results.at(-1)?.value]
			: [{ level: "", tags: new Map(), contexts: new Map() }]

		expect(level).toBe("error")
		expect(tags.get("app_originated")).toBe("true")
		expect(tags.get("error_surface")).toBe("vue-render")
		expect(contexts.get("app_root_error")).toMatchObject({
			surface: "vue-render",
			route: "/bridge",
			component: "BridgeOperations",
			info: "render function"
		})
	})

	it("deduplicates repeated object captures", () => {
		const error = new Error("boom")

		captureAppRootError({ error, surface: "window-error" })
		captureAppRootError({ error, surface: "window-error" })

		expect(captureException).toHaveBeenCalledTimes(1)
	})

	it("deduplicates repeated primitive captures", () => {
		captureAppRootError({
			error: "primitive-dedup-sentinel",
			surface: "unhandledrejection"
		})
		captureAppRootError({
			error: "primitive-dedup-sentinel",
			surface: "window-error"
		})

		expect(captureException).toHaveBeenCalledTimes(1)
	})
})
