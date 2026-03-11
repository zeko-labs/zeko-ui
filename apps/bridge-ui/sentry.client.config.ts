import * as Sentry from "@sentry/nuxt"
import { QuietError } from "~/errors"

const thirdPartyIgnorePatterns = [
	// Category A: Third-party browser extension noise
	"zaloJSV2 is not defined",
	/window\.misesEthereum/,
	"SecurityError: Blocked a frame",
	"Error: no ad",
	"TypeError: Illegal invocation",
	/Invalid property descriptor\. Cannot both specify accessors/,
	// Category D: User navigation (benign)
	"AbortError: The user aborted a request",
	// Category F: Unrelated wallet extensions
	"Failed to connect to MetaMask",
	"Attempting to use a disconnected port object",
	// Category G: Browser extension messaging
	"Failed to send message to background script"
]

Sentry.init({
	dsn: useRuntimeConfig().public.sentry.dsn,
	release: useRuntimeConfig().public.release,
	environment: useRuntimeConfig().public.environment,
	// https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option
	tunnel: "/tunnel",
	ignoreErrors: thirdPartyIgnorePatterns,
	beforeSend(event, hint) {
		if (hint?.originalException instanceof QuietError) return null
		// Filter errors tagged as exclusively third-party by thirdPartyErrorFilterIntegration
		if (event.tags?.["third_party_code"]) return null
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
