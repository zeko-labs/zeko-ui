import { Mina, } from 'o1js'

export const urls = {
    "mina:mainnet": "https://api.minascan.io/node/mainnet/v1/graphql",
    "mina:devnet": "https://api.minascan.io/node/devnet/v1/graphql",
    "zeko:testnet": "https://devnet.zeko.io/graphql",
    "zeko:mainnet": "NOT_IMPLEMENTED"
} as const
type Networks = keyof typeof urls

const toNetwork = (networkId: string): Networks => {
    if (Object.keys(urls).includes(networkId)) return networkId as Networks
    console.log("Unknown network, falling back to mina:devnet", networkId)
    return "mina:devnet" // Fallback to devnet
}

export async function getCurrentSlot() {
    const rawNetworkId = Mina.getNetworkId()
    const networkId = typeof rawNetworkId === 'string' ? `mina:${rawNetworkId}` : rawNetworkId.custom
    const endpoint = urls[toNetwork(networkId)]

    console.log(`Fetching current slot from: ${endpoint}`)

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            query: `
        query RuntimeConfig { runtimeConfig }
      `,
            variables: {}
        })
    })

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const result = await response.json()

    if (result.errors) throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`)

    const { data: { runtimeConfig } } = result

    const currentTimestamp = Date.now()
    const forkSlot = runtimeConfig.proof.fork.global_slot_since_genesis
    const genesisTimestamp = Date.parse(runtimeConfig.genesis.genesis_state_timestamp) / 1000

    const calculatedSlot = Math.floor(forkSlot + (((currentTimestamp / 1000) - genesisTimestamp) / 180))

    return `${currentTimestamp}_${calculatedSlot}`
}