import { handler as deposit } from "./points/deposit"
import { handler as faucet } from "./points/faucet"
import { handler as liquidity } from "./points/liquidity"
import { handler as swap } from "./points/swap"
import { handler as withdrawal } from "./points/withdrawal"

while (true) {
	const main = async () => {
		const depositEvents = await deposit.fetch()
		const withdrawalEvents = await withdrawal.fetch()
		const faucetEvents = await faucet.fetch()
		const liquidityEvents = await liquidity.fetch()
		const swapEvents = await swap.fetch()
		console.log({
			depositEvents,
			withdrawalEvents,
			faucetEvents,
			liquidityEvents,
			swapEvents
		})
	}
	main()
}
