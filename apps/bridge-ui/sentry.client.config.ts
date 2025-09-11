import * as Sentry from "@sentry/nuxt"

Sentry.init({
	dsn: useRuntimeConfig().public.sentry.dsn,
	release: useRuntimeConfig().public.release,
	// https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option
	tunnel: "/tunnel",
	// modify depending on your custom runtime config
	// Adds request headers and IP for users, for more info visit:
	// https://docs.sentry.io/platforms/javascript/guides/nuxt/configuration/options/#sendDefaultPii
	sendDefaultPii: true,
	//  session-replay
	// Replay may only be enabled for the client-side
	integrations: [
		Sentry.replayIntegration({ maskAllInputs: false, maskAllText: false, blockAllMedia: false })
	],
	//  session-replay
	//  performance
	// Set tracesSampleRate to 1.0 to capture 100%
	// of transactions for tracing.
	// We recommend adjusting this value in production
	// Learn more at
	// https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
	tracesSampleRate: 1.0,
	//  performance
	//  session-replay
	// Capture Replay for 10% of all sessions,
	// plus for 100% of sessions with an error
	// Learn more at
	// https://docs.sentry.io/platforms/javascript/session-replay/configuration/#general-integration-configuration
	replaysSessionSampleRate: 0.1,
	replaysOnErrorSampleRate: 1.0,
	//  session-replay
	//  logs
	// Enable logs to be sent to Sentry
	enableLogs: true
	//  logs
})
