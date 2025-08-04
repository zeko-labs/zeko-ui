import { createMinaClient, FetchZekoEvents, urls } from "@lumina-dex/sdk"
import { Field, PublicKey } from "o1js"


/**
 * Internal function to fetch all zeko events using the sequencer API.
 */
const fetchAllZekoEvents = async (address: string) => {
    const client = createMinaClient(urls["zeko:testnet"])
    const { data } = await client.query(FetchZekoEvents, { eventInput: { address } })
    if (!data) throw new Error("No data found")
    console.log("Fetched events:", data.events)
    return data.events
}


const getPubK = (data: string[]) => (a: number, b: number) => {
    return PublicKey.fromFields([Field.from(data[a]), Field.from(data[b])])
}

const processPoolFactoryEvents = async (events: Awaited<ReturnType<typeof fetchAllZekoEvents>>) => {
    const parsePoolEvents = (data: string[]) => {
        const pubk = getPubK(data)
        return { sender: pubk(1, 2), signer: pubk(3, 4), poolAddress: pubk(5, 6), token0Address: pubk(7, 8), token1Address: pubk(9, 10) }
    }
    // TODO: Find out if there's a more robust way to filter the events than their length
    const poolData = events.filter(event => event.eventData[0].data.length === 11).map((event) => {
        const data = event.eventData[0].data
        return parsePoolEvents(data)
    })
    return poolData
}

const processFaucetEvents = async (events: Awaited<ReturnType<typeof fetchAllZekoEvents>>) => {
    const parseFaucetEvents = (data: string[]) => {
        const pubk = getPubK(data)
        return { claimer: pubk(2, 3), amount: data[4] }
    }


    const faucetData = events.filter(event => event.eventData[0].data[0] === "0").map((event) => {
        const data = event.eventData[0].data
        console.log("Faucet event data:", data)
        return parseFaucetEvents(data)
    })
    console.log("Faucet data:", faucetData)
    return faucetData
}

Bun.serve({
    fetch: async () => {
        const events = await fetchAllZekoEvents("B62qnMgvs8iS6wVe56ajqcqtagAov2TGtvD3cWfEB7rAwfCU6x7HdgB")
        const faucetData = await processFaucetEvents(events)
        return Response.json(faucetData)
    }
})
