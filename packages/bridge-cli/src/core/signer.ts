type EnvLike = Partial<Record<string, string | undefined>>

export type SignerKeys = {
	mina: string
	zeko: string
	eth?: string
}

export const resolveSignerKeys = (env: EnvLike = process.env): SignerKeys => {
	const mina = env.ZEKO_BRIDGE_MINA_PRIVATE_KEY?.trim()
	if (!mina) {
		throw new Error("Missing required signer private key: ZEKO_BRIDGE_MINA_PRIVATE_KEY")
	}

	const zeko = env.ZEKO_BRIDGE_ZEKO_PRIVATE_KEY?.trim() || mina
	const eth = env.ZEKO_BRIDGE_ETH_PRIVATE_KEY?.trim() || undefined

	return { mina, zeko, eth }
}
