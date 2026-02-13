import { type ConsolaInstance, createConsola } from "consola"
import { sendMetric } from "./metrics"
import type { MetricEvent } from "./metrics.schema"

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const safeProcess = (globalThis as any).process || { env: {} }
export const getDebugConfig = () => {
	return {
		disableCache:
			globalThis.localStorage?.getItem("disableCache") === "true" ||
			safeProcess?.env?.BRIDGE_DEBUG_CONFIG_disableCache === "true",
		debugLogs:
			globalThis.localStorage?.getItem("debugLevel") === "true" ||
			safeProcess?.env?.NODE_ENV === "production"
				? 0
				: 5
	}
}

const logger = createConsola({
	level: getDebugConfig().debugLogs
}).withTag("BRIDGE")

const prefixedLogger = (prefix: string) =>
	new Proxy(logger, {
		get(target, prop) {
			const originalMethod = target[prop as keyof typeof target]

			if (typeof originalMethod === "function") {
				return (...args: unknown[]) => {
					const newArgs = [prefix, ...args]
					return Reflect.apply(originalMethod, target, newArgs)
				}
			}

			return originalMethod
		}
	})

const createMeasure = (l: ConsolaInstance) => (label: string) => {
	const start = performance.now()
	let done = false
	return () => {
		if (done) return
		const end = performance.now()
		l.warn(`${label}: ${end - start} ms`)
		done = true
	}
}

const prefixToCategory = (prefix: string): MetricEvent["category"] =>
	prefix
		.replace(/^\[/, "")
		.replace(/\]$/, "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_") as MetricEvent["category"]

type CreateLoggerOptions = { metrics?: boolean }

/**
 * Creates a prefixed logger with optional metric tracking.
 *
 * @param prefix - Logger prefix (e.g., "[BRIDGE]", "[TRANSACTION]")
 * @param options.metrics - Enable automatic metric tracking via sendMetric()
 *
 * When metrics are enabled, the act() function automatically sends:
 * - durationMs: Action execution time
 * - success: true/false
 * - label: Error message on failure
 * - category: Derived from prefix (e.g., "[BRIDGE OPERATION]" → "bridge_operation")
 */
export const createLogger = (prefix: string, options?: CreateLoggerOptions) => {
	const logger = prefixedLogger(prefix)
	const measure = createMeasure(logger)
	const metricsEnabled = options?.metrics === true
	const category = prefixToCategory(prefix)

	const act = async <T>(
		label: string,
		body: ({ stop }: { stop: () => void }) => Promise<T>,
		walletAddress: string | undefined
	) => {
		const start = performance.now()
		const stop = measure(label)
		logger.start(label)
		try {
			const result = await body({ stop })
			logger.success(label)
			stop()
			if (metricsEnabled) {
				sendMetric(
					{
						category,
						action: label,
						durationMs: performance.now() - start,
						success: true
					},
					walletAddress
				)
			}
			return result
		} catch (e) {
			logger.error(`${label} Error:`, e)
			stop()
			if (metricsEnabled) {
				const errorLabel = e instanceof Error ? e.message : String(e)
				sendMetric(
					{
						category,
						action: label,
						durationMs: performance.now() - start,
						success: false,
						label: errorLabel
					},
					walletAddress
				)
			}
			throw e
		}
	}
	return { act, logger, measure }
}
