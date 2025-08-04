import { luminadexFactories } from "@lumina-dex/sdk"
import { fetchAllZekoEvents, getPoolEvents, getPubK, processPoolFactoryEvents } from "../helper"

const processPoolEvents = async (events: Awaited<ReturnType<typeof getPoolEvents>>) => {
    const parseSwapEvents = (data: string[]) => {
        const pubk = getPubK(data)
        return { sender: pubk(1, 2), amountIn: data[3], amountOut: data[4] }
    }
    const swapData = events.map(([pool, events]) => {
        //TODO: Check if this is the correct event (SwapEvent)
        const data = events.filter((e) => e.eventData[0].data[0] === "0").map(e =>
            parseSwapEvents(e.eventData[0].data)
        )
        return [pool, data] as const
    })
    return swapData
}

export const handler = () => {
    const factory = luminadexFactories["zeko:testnet"]
    return {
        fetch: async () => {
            const events = await fetchAllZekoEvents(factory)
            const factoryData = await processPoolFactoryEvents(events)
            const pools = new Map(factoryData.map((pool) => [pool.poolAddress.toBase58(), { pool, swap: {} }]))
            const poolEvents = await getPoolEvents(Array.from(pools.keys()))
            const swapData = await processPoolEvents(poolEvents)
            for (const [pool, data] of swapData) {
                const poolData = pools.get(pool)
                if (poolData) {
                    pools.set(pool, { ...poolData, swap: data })
                }
            }
            return pools
        }
    }
}