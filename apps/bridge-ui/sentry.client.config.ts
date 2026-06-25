import * as Sentry from "@sentry/nuxt"
import { bridgeSentryReplayOptions } from "~/telemetry/sentryOptions"
import { beforeSendBridgeUiEvent, sentryIgnorePatterns } from "~/telemetry/sentryClient"

Sentry.init({
	dsn: useRuntimeConfig().public.sentry.dsn,
	release: useRuntimeConfig().public.release,
	environment: useRuntimeConfig().public.environment,
	// https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option
	tunnel: "/tunnel",
	ignoreErrors: sentryIgnorePatterns,
	beforeSend: beforeSendBridgeUiEvent,
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
	...bridgeSentryReplayOptions,
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
