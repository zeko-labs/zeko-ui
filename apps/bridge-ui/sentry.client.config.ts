import * as Sentry from "@sentry/nuxt"
import { QuietError } from "~/errors"

const ignorePatterns = [
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

Sentry.init({
	dsn: useRuntimeConfig().public.sentry.dsn,
	release: useRuntimeConfig().public.release,
	environment: useRuntimeConfig().public.environment,
	// https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option
	tunnel: "/tunnel",
	ignoreErrors: ignorePatterns,
	beforeSend(event, hint) {
		if (hint?.originalException instanceof QuietError) return null
		// Filter errors tagged as exclusively third-party by thirdPartyErrorFilterIntegration
		if (event.tags?.third_party_code) return null
		// Handle non-Error promise rejections (wallet extensions throw plain objects)
		const exception = hint?.originalException
		if (exception && typeof exception === "object" && !(exception instanceof Error)) {
			const obj = exception as Record<string, unknown>
			// Wallet rejection as plain object {code, message} — treat as QuietError
			if (
				"code" in obj &&
				"message" in obj &&
				/user reject|connection declined/i.test(String(obj.message))
			) {
				return null
			}
			// Empty object rejections — no useful signal
			if (Object.keys(obj).length === 0) return null
		}
		return event
	},
	// Adds request headers and IP for users, for more info visit:
	// https://docs.sentry.io/platforms/javascript/guides/nuxt/configuration/options/#sendDefaultPii
	sendDefaultPii: true,
	normalizeDepth: 7,
	integrations: [
		Sentry.replayIntegration({ maskAllInputs: false, maskAllText: false, blockAllMedia: false }),
		Sentry.replayCanvasIntegration(),
		Sentry.browserTracingIntegration(),
		Sentry.browserProfilingIntegration(),
		Sentry.piniaIntegration(usePinia()),
		Sentry.thirdPartyErrorFilterIntegration({
			filterKeys: ["@zeko/bridge-ui"],
			behaviour: "apply-tag-if-exclusively-contains-third-party-frames"
		})
	],
	//  session-replay
	// https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 1.0,
	// traces
	// https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
	tracesSampleRate: 0.05,
	// profiling
	// https://docs.sentry.io/platforms/javascript/guides/nuxt/profiling/browser/
	profilesSampleRate: 0.05,
	//  logs
	//TODO: Integrate with consola log reporter https://github.com/getsentry/sentry-javascript/issues/16659
	enableLogs: true
})
