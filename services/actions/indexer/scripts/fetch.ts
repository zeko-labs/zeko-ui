import { getNetworkTip, l1Client, logger } from "../src/helper"
import { handler as outerHandler } from "../src/modules/outer"

type EventType = "outer"

const eventConfigs = {
	outer: {
		handler: outerHandler,
		emoji: "💰",
		identifierField: "afterState"
	}
} as const

function getEventType(): EventType {
	const args = process.argv.slice(2)
	const eventType = args[0]?.toLowerCase()

	if (!eventType || !Object.keys(eventConfigs).includes(eventType)) {
		logger.error("❌ Invalid or missing event type")
		logger.info("Usage: bun scripts/fetch.ts <event-type>")
		logger.info("Available event types: outer")
		process.exit(1)
	}

	return eventType as EventType
}

function getUniqueIdentifiers<U extends string, T extends { [key in U]: string }[]>(
	data: T,
	identifierField: U
) {
	return new Set(data.map((event) => event[identifierField]))
}

type OuterEvent = Awaited<ReturnType<typeof outerHandler.fetch>>["data"][number]

async function main() {
	const eventType = getEventType()
	const config = eventConfigs[eventType]
	const { handler, emoji, identifierField } = config

	const startBlock = 0
	logger.info(`${emoji} Fetching ${eventType} events from block ${startBlock} to now...`)

	try {
		const result = await handler.fetch({ startBlock })
		const tip = await getNetworkTip(l1Client)
		logger.success(`✅ Fetch completed successfully`)
		logger.info(`📊 Last fetched block: ${result.lastFetchedBlock}`)
		logger.info(`📝 Total ${eventType} events found: ${result.data.length}`)

		if (result.data.length === 0) {
			logger.warn(`⚠️  No ${eventType} events found`)
			return
		}

		// NOTE: outer handler doesn't include a timestamp on the returned items; print blockHeight instead
		logger.box(`${eventType.charAt(0).toUpperCase() + eventType.slice(1)} Events:`)
		console.log(JSON.stringify(result.data, null, 2))

		// Print summary statistics
		logger.box("Summary Statistics:")
		const uniqueIdentifiers = getUniqueIdentifiers<"afterState", OuterEvent[]>(
			result.data,
			identifierField as "afterState"
		)
		console.log(`Total events: ${result.data.length}`)
		console.log(`Unique ${identifierField}s: ${uniqueIdentifiers.size}`)
		console.log(`Last Fetched Block: ${result.lastFetchedBlock}`)
		console.log(`Block range: ${startBlock} - ${tip}`)
	} catch (error) {
		logger.error(`❌ Error fetching ${eventType} events:`, error)
		throw error
	}
}

main().catch((error) => {
	console.error("Fatal error:", error)
	process.exit(1)
})
