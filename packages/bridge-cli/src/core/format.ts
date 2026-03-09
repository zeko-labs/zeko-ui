export const nanominaToMinaString = (value: bigint): string => {
	const whole = value / 1_000_000_000n
	const fraction = value % 1_000_000_000n
	if (fraction === 0n) return whole.toString()

	const padded = fraction.toString().padStart(9, "0").replace(/0+$/, "")
	return `${whole.toString()}.${padded}`
}
