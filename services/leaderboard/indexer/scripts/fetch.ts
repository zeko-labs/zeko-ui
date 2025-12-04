import { getMaxBlockHeight, logger } from "../src/helper"
import { handler as depositHandler } from "../src/points/deposit"
import { handler as faucetHandler } from "../src/points/faucet"
import { handler as liquidityHandler } from "../src/points/liquidity"
import { handler as swapHandler } from "../src/points/swap"
import { handler as withdrawalHandler } from "../src/points/withdrawal"
import { writeLog } from "./writeLog"

type EventType = "swap" | "deposit" | "faucet" | "liquidity" | "withdrawal"

const eventConfigs = {
	swap: {
		handler: swapHandler,
		emoji: "🔄",
		layer: "L2" as const,
		identifierField: "sender"
	},
	deposit: {
		handler: depositHandler,
		emoji: "💰",
		layer: "L2" as const,
		identifierField: "recipient"
	},
	faucet: {
		handler: faucetHandler,
		emoji: "🚰",
		layer: "L2" as const,
		identifierField: "claimer"
	},
	liquidity: {
		handler: liquidityHandler,
		emoji: "💧",
		layer: "L2" as const,
		identifierField: "sender"
	},
	withdrawal: {
		handler: withdrawalHandler,
		emoji: "💸",
		layer: "L1" as const,
		identifierField: "recipient"
	}
} as const

function getEventType(): EventType {
	const args = process.argv.slice(2)
	const eventType = args[0]?.toLowerCase()

	if (!eventType || !Object.keys(eventConfigs).includes(eventType)) {
		logger.error("❌ Invalid or missing event type")
		logger.info("Usage: bun scripts/fetch-events.ts <event-type>")
		logger.info("Available event types: swap, deposit, faucet, liquidity, withdrawal")
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

async function main() {
	const eventType = getEventType()
	const config = eventConfigs[eventType]
	const { handler, emoji, layer, identifierField } = config

	const startBlock = 0
	logger.info(`${emoji} Fetching ${eventType} events from block ${startBlock} to now...`)

	try {
		const result = await handler.fetch({ startBlock, endBlock: Number.POSITIVE_INFINITY })
		const maxBlockHeight = await getMaxBlockHeight(layer)
		logger.success(`✅ Fetch completed successfully`)
		logger.info(`📊 Last fetched block: ${result.lastFetchedBlock}`)
		logger.info(`📝 Total ${eventType} events found: ${result.data.length}`)

		if (result.data.length === 0) {
			logger.warn(`⚠️  No ${eventType} events found`)
			return
		}

		// Format timestamps for human readability
		const formattedData = result.data.map((event) => ({
			...event,
			timestamp: new Date(Number(event.timestamp)).toISOString()
		}))

		logger.box(`${eventType.charAt(0).toUpperCase() + eventType.slice(1)} Events:`)
		console.log(JSON.stringify(formattedData, null, 2))

		const addresses = formattedData.map((a) => {
			if ("sender" in a) return a.sender
			if ("recipient" in a) return a.recipient
			if ("claimer" in a) return a.claimer
			return null
		})

		writeLog({ log: { data: formattedData, addresses }, name: eventType }) // Raw data

		// Print summary statistics
		logger.box("Summary Statistics:")
		const uniqueIdentifiers = getUniqueIdentifiers(result.data as any, identifierField)
		console.log(`Total events: ${result.data.length}`)
		console.log(`Unique ${identifierField}s: ${uniqueIdentifiers.size}`)
		console.log(`Last Fetched Block: ${result.lastFetchedBlock}`)
		console.log(`Block range: ${startBlock} - ${maxBlockHeight}`)
	} catch (error) {
		logger.error(`❌ Error fetching ${eventType} events:`, error)
		throw error
	}
}

main().catch((error) => {
	console.error("Fatal error:", error)
	process.exit(1)
})
