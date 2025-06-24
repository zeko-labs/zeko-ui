import { archiveUrls, urls } from "@lumina-dex/sdk"
import { defineCommand, runMain } from "citty"
import { AccountUpdate, Mina, PrivateKey, UInt64 } from "o1js"
import * as v from 'valibot'
import { Faucet } from "../src/zkapp"

const deploy = async ({ network, fee: _fee }: { network: keyof typeof urls, fee: number }) => {

    const Schema = v.object({
        OWNER_PRIVATE_KEY: v.string(),
        FAUCET_PRIVATE_KEY: v.string(),
    })

    const env = v.parse(Schema, process.env)

    const Network = Mina.Network({
        mina: urls[network],
        archive: archiveUrls[network]
    })

    const fee = _fee * 1e9 // in nanomina (1 billion = 1.0 mina)
    Mina.setActiveInstance(Network)

    const ownerKey = PrivateKey.fromBase58(env.OWNER_PRIVATE_KEY)
    const sender = ownerKey.toPublicKey()
    const zkFaucetPrivateKey = PrivateKey.fromBase58(env.FAUCET_PRIVATE_KEY)
    const zkFaucetAddress = zkFaucetPrivateKey.toPublicKey()
    const zkFaucet = new Faucet(zkFaucetAddress)

    const amount = UInt64.from(BigInt(10_000_000_000))
    const transaction = await Mina.transaction({ sender, fee }, async () => {
        AccountUpdate.fundNewAccount(sender, 1)
        await zkFaucet.deploy({ amount })
    })
    await transaction.prove()
    await transaction.sign([ownerKey, zkFaucetPrivateKey]).send()
}

const main = defineCommand({
    meta: {
        name: "zeko-faucet",
        version: "1.0.0",
        description: "CLI to test and manage the Mina Faucet on zeko Testnet",
    },
    subCommands: {
        deploy: {
            meta: {
                name: "deploy",
                description: "Deploy the Faucet contract",
            },
            args: {
                network: {
                    type: "string",
                    description: "Can be mina:devnet, zeko:testnet, mina:mainnet, zeko:mainnet",
                    default: "mina:devnet",
                    required: true
                },
                fee: {
                    type: "number",
                    description: "Transaction fee in nanomina (1 mina = 1e9 nanomina)",
                    default: 1,
                    required: true
                }
            },
            run({ args }) {
                console.log("Deploying Faucet contract on network:", args.network)
                deploy({ network: args.network as keyof typeof urls, fee: args.fee as number })
            }
        }
    }
})

runMain(main)