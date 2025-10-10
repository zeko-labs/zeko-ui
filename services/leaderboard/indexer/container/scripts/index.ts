import { PrivateKey, PublicKey } from "o1js"

const main = () => {
	const input = process.argv[2]
	const privateKey = PrivateKey.fromBase58(input)
	const publicKey = PublicKey.fromPrivateKey(privateKey)
	console.log(publicKey.toBase58())
}

main()
