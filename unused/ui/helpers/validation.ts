import { type } from "arktype"

export const faucetBody = type({
	message: "string",
	"hash?": "string",
	"data?": "object"
})
