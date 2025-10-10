import { createMinaClient, FetchZekoEvents, urls } from "@lumina-dex/sdk"
import { Field, PublicKey } from "o1js"
import pLimit from "p-limit"

export const getPubK = (data: string[]) => (a: number, b: number) => {
	return PublicKey.fromFields([Field.from(data[a]), Field.from(data[b])])
}

export const fetchAllZekoEvents = async (address: string) => {
	const client = createMinaClient(urls["zeko:testnet"])
	const { data } = await client.query(FetchZekoEvents, { eventInput: { address } })
	if (!data) throw new Error("No data found")
	console.log("Fetched events:", data.events)
	return data.events
}

export const processPoolFactoryEvents = async (
	events: Awaited<ReturnType<typeof fetchAllZekoEvents>>
) => {
	const parsePoolEvents = (data: string[]) => {
		const pubk = getPubK(data)
		return {
			sender: pubk(1, 2),
			signer: pubk(3, 4),
			poolAddress: pubk(5, 6),
			token0Address: pubk(7, 8),
			token1Address: pubk(9, 10)
		}
	}
	// TODO: Find out if there's a more robust way to filter the events than their length
	const poolData = events
		.filter((event) => event.eventData[0].data.length === 11)
		.map((event) => {
			const data = event.eventData[0].data
			return parsePoolEvents(data)
		})
	return poolData
}

export const getPoolEvents = async (pools: string[]) => {
	// Concurrency limit
	const limit = pLimit(10)
	const fetchPool = async (pool: string) => {
		const events = await fetchAllZekoEvents(pool)
		return [pool, events] as const
	}
	const poolPromises = pools.map((pool) => limit(() => fetchPool(pool)))
	const events = await Promise.all(poolPromises)
	return events
}
