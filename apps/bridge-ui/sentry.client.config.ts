import * as Sentry from "@sentry/nuxt"
import { QuietError } from "~/errors"

const ignorePatterns = [
	// Category A: Third-party browser extension noise
	"zaloJSV2 is not defined",
	/window\.misesEthereum/,
	"SecurityError: Blocked a frame",
	"Error: no ad",
	"TypeError: Illegal invocation",
	/Invalid property descriptor\. Cannot both specify accessors/,
	// Category C: Network/backend errors (bridge-sdk already retries 5x via urql retryExchange)
	/CombinedError/,
	"TypeError: Load failed",
	"Unexpected end of input",
	"Error getting account data",
	// Category D: User navigation (benign)
	"AbortError: The user aborted a request",
	// Category F: Unrelated wallet extensions and Auro internals
	"Failed to connect to MetaMask",
	"Attempting to use a disconnected port object",
	/registeredMessage\[.*\]\.resolve/,
	"Error invoking post: Method not found",
	// Category G: Browser extension messaging and iOS WKWebView
	"Failed to send message to background script",
	"no messageHandlers",
	"WKWebView API client did not respond",
	// Category H: Third-party library internals (o1js)
	/Cannot assign to read only property.*toString.*Sha256/,
	/rangeCheck32/,
	"Reflect.getMetadata is not a function",
	// Category H: Browser environment edge cases
	"Failed to read 'localStorage'",
	"NotAllowedError: play() request was interrupted",
	/NotAllowedError.*play/,
	// bridge-sdk validation errors (corrupted chain data, user cannot fix)
	"Invalid actions data",
	"Invalid witnesses data",
	/Invalid commit.*withdrawal delay/,
	"Invalid runtime config",
	// XState race condition (guarded in code, filter residual)
	"Actor with system ID already exists"
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
