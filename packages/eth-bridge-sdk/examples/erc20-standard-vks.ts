import { compileEthereumTokenDeployment } from "@zeko-labs/bridge-sdk"
import { Mina } from "o1js"

const output = Bun.env.ERC20_STANDARD_VK_OUTPUT
if (!output) throw new Error("ERC20_STANDARD_VK_OUTPUT is required")

const networkId = Bun.env.MINA_SIGNING_NETWORK_ID === "mainnet" ? "mainnet" : "testnet"
Mina.setActiveInstance(
	Mina.Network({
		mina: "http://127.0.0.1:1/graphql",
		networkId
	})
)

const { adminVerificationKey, tokenVerificationKey } = await compileEthereumTokenDeployment()
const hashes = {
	mftTokenVkHash: tokenVerificationKey.hash.toString(),
	mftAdminVkHash: adminVerificationKey.hash.toString()
}

await Bun.write(output, `${JSON.stringify(hashes)}\n`)
console.log(JSON.stringify(hashes))
