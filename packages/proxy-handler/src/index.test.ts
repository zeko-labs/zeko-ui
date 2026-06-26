import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createProxyHandler } from "./index"

type FetchMock = ReturnType<typeof vi.fn<[Request], Promise<Response>>>

const requestUrl = "https://proxy.example/graphql?query=blocks"

function createHandler() {
	return createProxyHandler({
		primaryUrl: "https://primary.example/api",
		backupUrls: ["https://backup-one.example/api", "https://backup-two.example/api"]
	})
}

function expectRequestedUrls(fetchMock: FetchMock, urls: readonly string[]) {
	expect(fetchMock.mock.calls.map(([request]) => request.url)).toEqual(urls)
}

describe("createProxyHandler", () => {
	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => undefined)
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it("returns the primary response without trying backups", async () => {
		const fetchMock = vi
			.fn<[Request], Promise<Response>>()
			.mockResolvedValueOnce(new Response("primary", { status: 200 }))
		vi.stubGlobal("fetch", fetchMock)

		const response = await createHandler()(new Request(requestUrl))

		expect(response.status).toBe(200)
		expect(await response.text()).toBe("primary")
		expectRequestedUrls(fetchMock, ["https://primary.example/api/graphql?query=blocks"])
	})

	it("does not clone single-primary requests", async () => {
		const cloneSpy = vi.spyOn(Request.prototype, "clone")
		const fetchMock = vi
			.fn<[Request], Promise<Response>>()
			.mockResolvedValueOnce(new Response("primary", { status: 200 }))
		vi.stubGlobal("fetch", fetchMock)

		const response = await createProxyHandler({
			primaryUrl: "https://primary.example/api"
		})(new Request(requestUrl))

		expect(response.status).toBe(200)
		expect(cloneSpy).not.toHaveBeenCalled()
		expectRequestedUrls(fetchMock, ["https://primary.example/api/graphql?query=blocks"])
	})

	it("clones only attempts with remaining failover targets", async () => {
		const cloneSpy = vi.spyOn(Request.prototype, "clone")
		const fetchMock = vi
			.fn<[Request], Promise<Response>>()
			.mockResolvedValueOnce(new Response("primary error", { status: 503 }))
			.mockResolvedValueOnce(new Response("backup one", { status: 200 }))
		vi.stubGlobal("fetch", fetchMock)

		const response = await createProxyHandler({
			primaryUrl: "https://primary.example/api",
			backupUrls: ["https://backup-one.example/api"]
		})(new Request(requestUrl))

		expect(response.status).toBe(200)
		expect(cloneSpy).toHaveBeenCalledTimes(1)
		expectRequestedUrls(fetchMock, [
			"https://primary.example/api/graphql?query=blocks",
			"https://backup-one.example/api/graphql?query=blocks"
		])
	})

	it("tries the first backup after a primary network failure", async () => {
		const fetchMock = vi
			.fn<[Request], Promise<Response>>()
			.mockRejectedValueOnce(new Error("primary unavailable"))
			.mockResolvedValueOnce(new Response("backup one", { status: 200 }))
		vi.stubGlobal("fetch", fetchMock)

		const response = await createHandler()(new Request(requestUrl))

		expect(response.status).toBe(200)
		expect(await response.text()).toBe("backup one")
		expectRequestedUrls(fetchMock, [
			"https://primary.example/api/graphql?query=blocks",
			"https://backup-one.example/api/graphql?query=blocks"
		])
	})

	it("aborts a hanging primary after the configured timeout and tries a backup", async () => {
		vi.useFakeTimers()
		const fetchMock = vi
			.fn<[Request], Promise<Response>>()
			.mockImplementationOnce(
				(request) =>
					new Promise((_, reject) => {
						request.signal.addEventListener("abort", () => reject(request.signal.reason))
					})
			)
			.mockResolvedValueOnce(new Response("backup one", { status: 200 }))
		vi.stubGlobal("fetch", fetchMock)

		const responsePromise = createProxyHandler({
			primaryUrl: "https://primary.example/api",
			backupUrls: ["https://backup-one.example/api"],
			options: { upstreamTimeoutMs: 10 }
		})(new Request(requestUrl))

		await vi.advanceTimersByTimeAsync(10)
		const response = await responsePromise

		expect(response.status).toBe(200)
		expect(await response.text()).toBe("backup one")
		expect(fetchMock.mock.calls[0]?.[0].signal.aborted).toBe(true)
		expectRequestedUrls(fetchMock, [
			"https://primary.example/api/graphql?query=blocks",
			"https://backup-one.example/api/graphql?query=blocks"
		])
	})

	it("returns 504 when all backends exceed the configured timeout", async () => {
		vi.useFakeTimers()
		const fetchMock = vi.fn<[Request], Promise<Response>>().mockImplementation(
			(request) =>
				new Promise((_, reject) => {
					request.signal.addEventListener("abort", () => reject(request.signal.reason))
				})
		)
		vi.stubGlobal("fetch", fetchMock)

		const responsePromise = createProxyHandler({
			primaryUrl: "https://primary.example/api",
			backupUrls: ["https://backup-one.example/api"],
			options: { upstreamTimeoutMs: 10 }
		})(new Request(requestUrl))

		await vi.advanceTimersByTimeAsync(10)
		await vi.advanceTimersByTimeAsync(10)
		const response = await responsePromise

		expect(response.status).toBe(504)
		expect(await response.text()).toBe("Origin fetch timed out")
		expect(fetchMock.mock.calls.every(([request]) => request.signal.aborted)).toBe(true)
		expectRequestedUrls(fetchMock, [
			"https://primary.example/api/graphql?query=blocks",
			"https://backup-one.example/api/graphql?query=blocks"
		])
	})

	it("tries the first backup after a primary 5xx response", async () => {
		const fetchMock = vi
			.fn<[Request], Promise<Response>>()
			.mockResolvedValueOnce(new Response("primary error", { status: 503 }))
			.mockResolvedValueOnce(new Response("backup one", { status: 200 }))
		vi.stubGlobal("fetch", fetchMock)

		const response = await createHandler()(new Request(requestUrl))

		expect(response.status).toBe(200)
		expect(await response.text()).toBe("backup one")
		expectRequestedUrls(fetchMock, [
			"https://primary.example/api/graphql?query=blocks",
			"https://backup-one.example/api/graphql?query=blocks"
		])
	})

	it("tries multiple backups in configured order", async () => {
		const fetchMock = vi
			.fn<[Request], Promise<Response>>()
			.mockRejectedValueOnce(new Error("primary unavailable"))
			.mockResolvedValueOnce(new Response("backup one error", { status: 500 }))
			.mockResolvedValueOnce(new Response("backup two", { status: 200 }))
		vi.stubGlobal("fetch", fetchMock)

		const response = await createHandler()(new Request(requestUrl))

		expect(response.status).toBe(200)
		expect(await response.text()).toBe("backup two")
		expectRequestedUrls(fetchMock, [
			"https://primary.example/api/graphql?query=blocks",
			"https://backup-one.example/api/graphql?query=blocks",
			"https://backup-two.example/api/graphql?query=blocks"
		])
	})

	it("returns the last backend 5xx response when every target is unavailable", async () => {
		const fetchMock = vi
			.fn<[Request], Promise<Response>>()
			.mockRejectedValueOnce(new Error("primary unavailable"))
			.mockResolvedValueOnce(new Response("backup one error", { status: 503 }))
			.mockResolvedValueOnce(new Response("backup two error", { status: 502 }))
		vi.stubGlobal("fetch", fetchMock)

		const response = await createHandler()(new Request(requestUrl))

		expect(response.status).toBe(502)
		expect(await response.text()).toBe("backup two error")
		expectRequestedUrls(fetchMock, [
			"https://primary.example/api/graphql?query=blocks",
			"https://backup-one.example/api/graphql?query=blocks",
			"https://backup-two.example/api/graphql?query=blocks"
		])
	})

	it("cancels superseded 5xx response bodies", async () => {
		const cancelFirstBody = vi.fn()
		const firstUnavailableResponse = new Response(
			new ReadableStream({
				cancel: cancelFirstBody
			}),
			{ status: 503 }
		)
		const finalUnavailableResponse = new Response("backup two error", { status: 502 })
		const fetchMock = vi
			.fn<[Request], Promise<Response>>()
			.mockResolvedValueOnce(firstUnavailableResponse)
			.mockResolvedValueOnce(finalUnavailableResponse)
		vi.stubGlobal("fetch", fetchMock)

		const response = await createProxyHandler({
			primaryUrl: "https://primary.example/api",
			backupUrls: ["https://backup-one.example/api"]
		})(new Request(requestUrl))

		expect(cancelFirstBody).toHaveBeenCalledTimes(1)
		expect(response.status).toBe(502)
		expect(await response.text()).toBe("backup two error")
		expectRequestedUrls(fetchMock, [
			"https://primary.example/api/graphql?query=blocks",
			"https://backup-one.example/api/graphql?query=blocks"
		])
	})

	it("returns a proxy 502 when every target fails without a backend response", async () => {
		const fetchMock = vi
			.fn<[Request], Promise<Response>>()
			.mockRejectedValueOnce(new Error("primary unavailable"))
			.mockRejectedValueOnce(new Error("backup one unavailable"))
			.mockRejectedValueOnce(new Error("backup two unavailable"))
		vi.stubGlobal("fetch", fetchMock)

		const response = await createHandler()(new Request(requestUrl))

		expect(response.status).toBe(502)
		expect(await response.text()).toBe("Origin fetch error: backup two unavailable")
		expectRequestedUrls(fetchMock, [
			"https://primary.example/api/graphql?query=blocks",
			"https://backup-one.example/api/graphql?query=blocks",
			"https://backup-two.example/api/graphql?query=blocks"
		])
	})

	it("does not fail over for 4xx responses", async () => {
		const fetchMock = vi
			.fn<[Request], Promise<Response>>()
			.mockResolvedValueOnce(new Response("not found", { status: 404 }))
		vi.stubGlobal("fetch", fetchMock)

		const response = await createHandler()(new Request(requestUrl))

		expect(response.status).toBe(404)
		expect(await response.text()).toBe("not found")
		expectRequestedUrls(fetchMock, ["https://primary.example/api/graphql?query=blocks"])
	})

	it("applies CORS headers to backup responses", async () => {
		const fetchMock = vi
			.fn<[Request], Promise<Response>>()
			.mockResolvedValueOnce(new Response("primary error", { status: 503 }))
			.mockResolvedValueOnce(new Response("backup one", { status: 200 }))
		vi.stubGlobal("fetch", fetchMock)

		const response = await createProxyHandler({
			primaryUrl: "https://primary.example/api",
			backupUrls: ["https://backup-one.example/api"],
			options: {
				cors: {
					origins: ["https://app.example"]
				}
			}
		})(
			new Request(requestUrl, {
				headers: {
					Origin: "https://app.example"
				}
			})
		)

		expect(response.status).toBe(200)
		expect(await response.text()).toBe("backup one")
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example")
		expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true")
	})
})
