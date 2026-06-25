import { afterEach, describe, expect, it, vi } from "vitest"
import { dispatch } from "../../app/service-worker/notifications"

describe("bridge notifications", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("does not request permission or log an error when no service worker is registered", async () => {
		const requestPermission = vi.fn(async () => "granted" as NotificationPermission)
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined)

		await dispatch(
			{ title: "Bridge update", options: {} },
			{
				browserWindow: {
					Notification: { requestPermission } as typeof Notification
				},
				navigator: {
					serviceWorker: {
						getRegistration: vi.fn(async () => undefined)
					}
				}
			}
		)

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
