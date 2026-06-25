import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Event, EventHint } from "@sentry/core"
import { beforeSendBridgeUiEvent } from "../../app/telemetry/sentryClient"

describe("sentry.client.config", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it("keeps app-originated events even when third_party_code is present", async () => {
		const event = {
			tags: {
				third_party_code: true,
				app_originated: "true"
			}
		} satisfies Event

		expect(beforeSendBridgeUiEvent(event, {})).toBe(event)
	})

	it("still drops third-party-only events", async () => {
		const event = {
			tags: {
				third_party_code: true
			}
		} satisfies Event

		expect(beforeSendBridgeUiEvent(event, {})).toBeNull()
	})

	it("drops empty object rejections", () => {
		const event = {} satisfies Event

		expect(beforeSendBridgeUiEvent(event, { originalException: {} } satisfies EventHint)).toBeNull()
	})

	it("drops wallet rejection objects only when code and message are present", () => {
		const event = {} satisfies Event

		expect(
			beforeSendBridgeUiEvent(event, {
				originalException: { code: 4001, message: "user reject" }
			} satisfies EventHint)
		).toBeNull()

		expect(
			beforeSendBridgeUiEvent(event, {
				originalException: { message: "user reject" }
			} satisfies EventHint)
		).toBe(event)
	})

	it("keeps baseline replay sampling enabled for production diagnosis", async () => {
		const { bridgeSentryReplayOptions } = await import("../../app/telemetry/sentryOptions")

		expect(bridgeSentryReplayOptions.replaysSessionSampleRate).toBeGreaterThan(0)
		expect(bridgeSentryReplayOptions.replaysOnErrorSampleRate).toBe(1)
	})
})
