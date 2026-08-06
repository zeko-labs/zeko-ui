import { PrivateKey, TokenId } from "o1js"
import { toHex } from "viem"
import { packZekoAddress } from "../src/codecs"

const required = (name: string): string => {
	const value = Bun.env[name]
	if (!value) throw new Error(`${name} is required`)
	return value
}

const publicKey = (name: string) => PrivateKey.fromBase58(required(name)).toPublicKey()
const tokenOwner = publicKey("ERC20_TOKEN_OWNER_PRIVATE_KEY")
const tokenVault = publicKey("ERC20_TOKEN_VAULT_PRIVATE_KEY")
const adminContract = publicKey("ERC20_ADMIN_CONTRACT_PRIVATE_KEY")
const adminAuthority = publicKey("ERC20_ADMIN_AUTHORITY_PRIVATE_KEY")
const tokenId = TokenId.derive(tokenOwner)

const identity = {
	tokenOwner: tokenOwner.toBase58(),
	tokenOwnerPacked: packZekoAddress(tokenOwner),
	tokenId: tokenId.toString(),
	tokenIdBase58: TokenId.toBase58(tokenId),
	tokenIdHex: toHex(tokenId.toBigInt(), { size: 32 }),
	tokenVault: tokenVault.toBase58(),
	tokenVaultPacked: packZekoAddress(tokenVault),
	adminContract: adminContract.toBase58(),
	adminAuthority: adminAuthority.toBase58()
}

await Bun.write(required("ERC20_IDENTITY_OUTPUT"), `${JSON.stringify(identity)}\n`)
console.log(JSON.stringify(identity))
