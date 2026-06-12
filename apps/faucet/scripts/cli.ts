import { archiveUrls, urls } from "@lumina-dex/sdk"
import { ZEKO_M_NETWORKS } from "@zeko/networks"
import { defineCommand, runMain } from "citty"
import { AccountUpdate, Mina, PrivateKey, UInt64 } from "o1js"
import * as v from "valibot"
import { Faucet } from "../src/zkapp"

type FaucetArgs = {
	network: keyof typeof urls
	fee: string
}

const SUPPORTED_FAUCET_NETWORKS = [
	"mina:devnet",
	"mina:mainnet",
	ZEKO_M_NETWORKS.testnet,
	ZEKO_M_NETWORKS.mainnet
] as const

type FaucetNetwork = (typeof SUPPORTED_FAUCET_NETWORKS)[number]

const isFaucetNetwork = (network: string): network is FaucetNetwork =>
	SUPPORTED_FAUCET_NETWORKS.includes(network as FaucetNetwork)

const LUMINA_NETWORK_BY_FAUCET_NETWORK = {
	[ZEKO_M_NETWORKS.testnet]: "zeko:testnet",
	[ZEKO_M_NETWORKS.mainnet]: "zeko:mainnet"
} as const satisfies Partial<Record<FaucetNetwork, keyof typeof urls>>

const toLuminaNetwork = (network: string): keyof typeof urls => {
	if (!isFaucetNetwork(network)) {
		throw new Error(
			`Unsupported network: ${network}. Expected one of ${SUPPORTED_FAUCET_NETWORKS.join(", ")}`
		)
	}

	return LUMINA_NETWORK_BY_FAUCET_NETWORK[network] ?? network
}

const setup = ({ network, fee: _fee }: FaucetArgs) => {
	const Schema = v.object({
		OWNER_PRIVATE_KEY: v.string(),
		FAUCET_PRIVATE_KEY: v.string()
	})
	const env = v.parse(Schema, process.env)

	const Network = Mina.Network({
		mina: urls[network],
		archive: archiveUrls[network]
	})

	const fee = Number(_fee) * 1e9 // in nanomina (1 billion = 1.0 mina)
	Mina.setActiveInstance(Network)

	const ownerKey = PrivateKey.fromBase58(env.OWNER_PRIVATE_KEY)
	const sender = ownerKey.toPublicKey()
	const zkFaucetPrivateKey = PrivateKey.fromBase58(env.FAUCET_PRIVATE_KEY)
	const zkFaucetAddress = zkFaucetPrivateKey.toPublicKey()
	const zkFaucet = new Faucet(zkFaucetAddress)

	return { env, fee, ownerKey, sender, zkFaucetAddress, zkFaucetPrivateKey, zkFaucet }
}

const deploy = async ({ network, fee: _fee }: FaucetArgs) => {
	const { ownerKey, sender, zkFaucetPrivateKey, zkFaucet, fee } = setup({ network, fee: _fee })

	const amount = UInt64.from(BigInt(10 * 1e9))
	const transaction = await Mina.transaction({ sender, fee }, async () => {
		AccountUpdate.fundNewAccount(sender, 1)
		await zkFaucet.deploy({ amount })
	})
	await transaction.prove()
	await transaction.sign([ownerKey, zkFaucetPrivateKey]).send()
}

const changeAmount = async ({
	network,
	fee: _fee,
	amount: _amount
}: FaucetArgs & { amount: string }) => {
	const { zkFaucetAddress, zkFaucetPrivateKey, zkFaucet, fee } = setup({ network, fee: _fee })
	const amount = UInt64.from(BigInt(_amount) * BigInt(1e9)) // Convert to nanomina

	const txn = await Mina.transaction({ sender: zkFaucetAddress, fee }, async () => {
		await zkFaucet.updateAmount(amount)
	})
	await txn.prove()
	await txn.sign([zkFaucetPrivateKey]).send()
}

const main = defineCommand({
	meta: {
		name: "zeko-faucet",
		version: "1.0.0",
		description: "CLI to deploy and manage the Mina Faucet on Zeko-M testnet"
	},
	args: {
		network: {
			type: "string",
			description: "One of mina:devnet, zeko-m:testnet, mina:mainnet, zeko-m:mainnet",
			default: "mina:devnet",
			required: true
		},
		fee: {
			type: "string",
			description: "Transaction fee in MINA",
			default: "1",
			required: true
		}
	},
	subCommands: {
		deploy: {
			meta: {
				name: "deploy",
				description: "Deploy the Faucet contract"
			},
			run({ args }) {
				console.log("Deploying Faucet contract on network:", args.network)
				deploy({ network: toLuminaNetwork(args.network as string), fee: args.fee as string })
			}
		},
		"change-amount": {
			meta: {
				name: "change-amount",
				description: "Change the amount of MINA in the Faucet contract"
			},
			args: {
				amount: {
					type: "string",
					description: "New amount to set in MINA",
					required: true
				}
			},
			run({ args }) {
				console.log("Changing Faucet contract amount on network:", args.network)
				changeAmount({
					network: toLuminaNetwork(args.network as string),
					fee: args.fee as string,
					amount: args.amount as string
				})
			}
		}
	}
})

runMain(main)
