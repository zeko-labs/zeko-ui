import { createMinaClient, urls } from "@lumina-dex/sdk"
import { FetchZekoArchiveEvents } from "@zeko/graphql/zeko-archive"
import { Field, PublicKey } from "o1js"

const zekoBoomStartBlock = 0
const lastFetchedBlock = 0

export const TZEKO_MINA = "poolAddress"
export const BridgeAddress = "bridgeAddress"

export const getPubK = (data: string[]) => (a: number, b: number) => {
	return PublicKey.fromFields([Field.from(data[a]), Field.from(data[b])])
}

export const fetchArchiveEvents = async (address: string) => {
	const client = createMinaClient(urls["zeko:testnet"])
	const { data } = await client.query(FetchZekoArchiveEvents, {
		input: { address, status: "CANONICAL", from: zekoBoomStartBlock }
	})
	if (!data) throw new Error("No data found")
	if (!data.events) throw new Error("No events found")
	console.log("Fetched events:", data.events)
	return data.events
}

export type ArchiveEvents = Awaited<ReturnType<typeof fetchArchiveEvents>>
