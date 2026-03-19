type EnvLike = Partial<Record<string, string | undefined>>

export type SignerKeys = {
	mina: string
	zeko: string
	eth?: string
}

export const resolveSignerKeys = (env: EnvLike = process.env): SignerKeys => {
	const wallet = env.WALLET_PRIVATE_KEY?.trim()
	if (!wallet) {
		throw new Error("Missing required signer private key: WALLET_PRIVATE_KEY")
	}

	return { mina: wallet, zeko: wallet }
}
