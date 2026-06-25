import * as Sentry from "@sentry/nuxt"
import { QuietError } from "../errors"

export type BridgeSentryContext = {
	category: string
	action: string
	walletAddress?: string
	source?: string
	destination?: string
	direction?: string
}

export const BRIDGE_METRIC_LABEL_MAX_LENGTH = 500

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim()

const truncateBridgeMetricLabel = (value: string): string =>
	value.length <= BRIDGE_METRIC_LABEL_MAX_LENGTH
		? value
		: `${value.slice(0, BRIDGE_METRIC_LABEL_MAX_LENGTH - 3)}...`

const serializeBridgeErrorValue = (value: unknown): string | undefined => {
	const seen = new WeakSet<object>()

	try {
		const json = JSON.stringify(value, (_key, nestedValue) => {
			if (typeof nestedValue === "bigint") {
				return nestedValue.toString()
			}

			if (nestedValue instanceof Error) {
				return {
					name: nestedValue.name,
					message: nestedValue.message,
					stack: nestedValue.stack
				}
			}

			if (typeof nestedValue === "object" && nestedValue !== null) {
				if (seen.has(nestedValue)) {
					return "[Circular]"
				}

				seen.add(nestedValue)
			}

			return nestedValue
		})

		return typeof json === "string" && json.length > 0 ? json : undefined
	} catch {
		return undefined
	}
}

export const describeBridgeError = (error: unknown): string => {
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message
	}

	if (typeof error === "object" && error !== null) {
		if ("message" in error) {
			const message = String((error as { message: unknown }).message)

			if (message.trim().length > 0) {
				return message
			}
		}

		const json = serializeBridgeErrorValue(error)

		if (json) {
			return `Non-Error object: ${json}`
		}

		return "Non-Error object: {}"
	}

	return String(error)
}

export const describeBridgeMetricLabel = (error: unknown): string =>
	truncateBridgeMetricLabel(describeBridgeError(error))

export const normalizeBridgeErrorMessage = (message: string): string =>
	normalizeWhitespace(message)
		.replace(/\b\d{20,}\b/g, "<bigint>")
		.replace(/line \d+, characters \d+-\d+/g, "line <line>, characters <range>")

export const buildBridgeErrorFingerprint = ({
	category,
	action,
	message
}: {
	category: string
	action: string
	message: string
}): string[] => ["bridge-ui", category, action, normalizeBridgeErrorMessage(message)]

export const shouldSkipBridgeErrorCapture = (error: unknown): boolean => error instanceof QuietError

export const captureBridgeError = ({
	error,
	context
}: {
	error: unknown
	context: BridgeSentryContext
}) => {
	if (shouldSkipBridgeErrorCapture(error)) {
		return
	}

	const message = describeBridgeError(error)
	const normalizedMessage = normalizeBridgeErrorMessage(message)
	const captureTarget =
		error instanceof Error || (typeof error === "object" && error !== null)
			? error
			: new Error(message)

	Sentry.withScope((scope) => {
		scope.setLevel("error")
		scope.setTag("app_originated", "true")
		scope.setTag("bridge_category", context.category)
		scope.setTag("bridge_action", context.action)
		scope.setTag("bridge_wallet_present", context.walletAddress ? "true" : "false")

		if (context.source) {
			scope.setTag("bridge_source", context.source)
		}

		if (context.destination) {
			scope.setTag("bridge_destination", context.destination)
		}

		if (context.direction) {
			scope.setTag("bridge_direction", context.direction)
		}

		scope.setContext("bridge_metric", {
			category: context.category,
			action: context.action,
			source: context.source,
			destination: context.destination,
			direction: context.direction,
			walletAddressPresent: Boolean(context.walletAddress),
			errorMessage: message,
			normalizedErrorMessage: normalizedMessage
		})
		scope.setFingerprint(
			buildBridgeErrorFingerprint({
				category: context.category,
				action: context.action,
				message
			})
		)
		Sentry.captureException(captureTarget)
	})
}
