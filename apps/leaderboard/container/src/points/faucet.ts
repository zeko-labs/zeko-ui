import { fetchAllZekoEvents, getPubK } from "../helper"

const processFaucetEvents = async (events: Awaited<ReturnType<typeof fetchAllZekoEvents>>) => {
    const parseFaucetEvents = (data: string[]) => {
        const pubk = getPubK(data)
        return { claimer: pubk(2, 3), amount: data[4] }
    }

    const faucetData = events.filter(e => e.eventData[0].data[0] === "0").map((e) => {
        return parseFaucetEvents(e.eventData[0].data)
    })
    return faucetData
}

export const handler = () => {
    const faucetAddress = "B62qnMgvs8iS6wVe56ajqcqtagAov2TGtvD3cWfEB7rAwfCU6x7HdgB"
    return {
        fetch: async () => {
            const events = await fetchAllZekoEvents(faucetAddress)
            const faucetData = await processFaucetEvents(events)
            return faucetData
        }
    }
}