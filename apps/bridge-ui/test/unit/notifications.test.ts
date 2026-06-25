import { afterEach, describe, expect, it, vi } from "vitest"
import { dispatch } from "../../app/service-worker/notifications"

describe("bridge notifications", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("rejects when no service worker is registered outside quiet verification contexts", async () => {
		const requestPermission = vi.fn(async () => "granted" as NotificationPermission)

		await expect(
			dispatch(
				{ title: "Bridge update", options: {} },
				{
					browserWindow: {
						Notification: { requestPermission } as typeof Notification
					},
					debugMode: "off",
					hostname: "bridge.zeko.io",
					navigator: {
						serviceWorker: {
							getRegistration: vi.fn(async () => undefined)
						}
					}
				}
			)
		).rejects.toThrow("No service worker registration found.")

		expect(requestPermission).not.toHaveBeenCalled()
	})

	it("does not request permission or log an error when no service worker is registered in mock debug mode", async () => {
		const requestPermission = vi.fn(async () => "granted" as NotificationPermission)
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined)

		await expect(
			dispatch(
				{ title: "Bridge update", options: {} },
				{
					browserWindow: {
						Notification: { requestPermission } as typeof Notification
					},
					debugMode: "mock-backend",
					hostname: "bridge.zeko.io",
					navigator: {
						serviceWorker: {
							getRegistration: vi.fn(async () => undefined)
						}
					}
				}
			)
		).resolves.toBeUndefined()

		await expect(
			dispatch(
				{ title: "Bridge update", options: {} },
				{
					browserWindow: {
						Notification: { requestPermission } as typeof Notification
					},
					debugMode: "off",
					hostname: "localhost",
					navigator: {
						serviceWorker: {
							getRegistration: vi.fn(async () => undefined)
						}
					}
				}
			)
		).resolves.toBeUndefined()

		expect(requestPermission).not.toHaveBeenCalled()
		expect(error).not.toHaveBeenCalled()
		expect(log).not.toHaveBeenCalled()
	})

	it("shows the notification after permission is granted and a service worker is registered", async () => {
		const requestPermission = vi.fn(async () => "granted" as NotificationPermission)
		const showNotification = vi.fn()

		await dispatch(
			{ title: "Bridge update", options: { body: "Ready to claim" } },
			{
				browserWindow: {
					Notification: { requestPermission } as typeof Notification
				},
				navigator: {
					serviceWorker: {
						getRegistration: vi.fn(async () => ({ showNotification }))
					}
				}
			}
		)

		expect(requestPermission).toHaveBeenCalledOnce()
		expect(showNotification).toHaveBeenCalledWith("Bridge update", { body: "Ready to claim" })
	})
})
