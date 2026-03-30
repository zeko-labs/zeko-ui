import type * as Sentry from "@sentry/nuxt"
import { QuietError, isWalletRejection } from "../errors"

type SentryInitOptions = Parameters<typeof Sentry.init>[0]
type BeforeSend = NonNullable<Extract<SentryInitOptions, { beforeSend?: unknown }>["beforeSend"]>
type SentryEvent = Parameters<BeforeSend>[0]
type SentryHint = Parameters<BeforeSend>[1]

export const sentryIgnorePatterns: Array<string | RegExp> = [
	// Category A: Third-party browser extension noise — not our code, zero signal
	"zaloJSV2 is not defined",
	/window\.misesEthereum/,
	"SecurityError: Blocked a frame",
	"Error: no ad",
	"TypeError: Illegal invocation",
	/Invalid property descriptor\. Cannot both specify accessors/,
	// Category D: User navigation — benign, user navigated away
	"AbortError: The user aborted a request",
	// Category F: Unrelated wallet extensions — not our code
	"Failed to connect to MetaMask",
	"Attempting to use a disconnected port object",
	/registeredMessage\[.*\]\.resolve/,
	// Category G: Browser extension messaging and iOS WKWebView
	"Failed to send message to background script",
	"no messageHandlers",
	"WKWebView API client did not respond",
	// o1js internal: read-only property mutation, not triggered by our code
	/Cannot assign to read only property.*toString.*Sha256/,
	// Browser autoplay policy: background videos are muted+playsinline, cosmetic
	/NotAllowedError.*play/
]

export const isAppOriginatedEvent = (event: SentryEvent): boolean =>
	event.tags?.app_originated === "true"

const isWalletRejectionObject = (obj: Record<string, unknown>): boolean =>
	"code" in obj && "message" in obj && isWalletRejection(obj)

const shouldDropThirdPartyOnlyEvent = (event: SentryEvent): boolean =>
	Boolean(event.tags?.third_party_code) && !isAppOriginatedEvent(event)

export const beforeSendBridgeUiEvent: BeforeSend = (
	event: SentryEvent,
	hint?: SentryHint
): SentryEvent | null => {
	if (hint?.originalException instanceof QuietError) return null
	if (shouldDropThirdPartyOnlyEvent(event)) return null

	const exception = hint?.originalException
	if (exception && typeof exception === "object" && !(exception instanceof Error)) {
		const obj = exception as Record<string, unknown>

		if (isWalletRejectionObject(obj)) return null
		if (Object.keys(obj).length === 0) {
			return null
		}
	}

	return event
}
