import { createTheme } from "./themer"

type Colors = {
	[key: string]: string | Colors
}

const colors = {
	alpha: {
		softGray1: "oklch(14.48% 0 0 / 12%)",
		softGray2: "oklch(14.48% 0 0 / 24%)"
	},
	gray: {
		50: "oklch(97.315% 0 0)",
		100: "oklch(92.797% 0 0)",
		200: "oklch(86.069% 0 0)",
		500: "oklch(53.476% 0 0)",
		800: "oklch(39.042% 0 0)",
		900: "oklch(36.002% 0 0)",
		950: "oklch(14.479% 0 0)"
	},
	cosmicGold: {
		50: "oklch(91.642% 0.15696 98.188)",
		90: "oklch(73.683% 0.13788 73.881)",
		100: "oklch(72.311% 0.13818 71.166)",
		200: "oklch(59.222% 0.10877 74.108)"
	},
	spaceBlue: "oklch(97.315% 0 0 / 0.56)"
} as const satisfies Colors

// :root {
// 	--size--2: clamp(0.56rem, 0.537rem + 0.1148vw, 0.64rem);
// 	--size--1: clamp(0.7rem, 0.6713rem + 0.1435vw, 0.8rem);
// 	--size-0: clamp(0.875rem, 0.8391rem + 0.1794vw, 1rem);
// 	--size-1: clamp(1.0938rem, 1.0489rem + 0.2242vw, 1.25rem);
// 	--size-2: clamp(1.3672rem, 1.3111rem + 0.2803vw, 1.5625rem);
// 	--size-3: clamp(1.709rem, 1.6389rem + 0.3503vw, 1.9531rem);
// 	--size-4: clamp(2.1362rem, 2.0486rem + 0.4379vw, 2.4414rem);
// 	--size-5: clamp(2.6703rem, 2.5608rem + 0.5474vw, 3.0518rem);
//   }

const steps = [
	"clamp(0.56rem, 0.537rem + 0.1148vw, 0.64rem)",
	"clamp(0.7rem, 0.6713rem + 0.1435vw, 0.8rem)",
	"clamp(0.875rem, 0.8391rem + 0.1794vw, 1rem)",
	"clamp(1.0938rem, 1.0489rem + 0.2242vw, 1.25rem)",
	"clamp(1.3672rem, 1.3111rem + 0.2803vw, 1.5625rem)",
	"clamp(1.709rem, 1.6389rem + 0.3503vw, 1.9531rem)",
	"clamp(2.1362rem, 2.0486rem + 0.4379vw, 2.4414rem)",
	"clamp(2.6703rem, 2.5608rem + 0.5474vw, 3.0518rem)"
] as const

type Prettify<T> = {
	[K in keyof T]: T[K]
} & {}

type SizeEntry<E extends string, Index extends number> = [`size-${Index}`, E]

//@ts-expect-error number => number & I
type ScaleEntries<A extends readonly string[]> = { [I in keyof A]: Prettify<SizeEntry<A[I], I>> }

const typeSafeObjectFromEntries = <const T extends ReadonlyArray<readonly [PropertyKey, unknown]>>(
	entries: T
): { [K in T[number] as K[0]]: K[1] } => {
	return Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] }
}

const entries = steps.map(
	(step, index) => [`size-${index}` as const, step] as const
) as unknown as ScaleEntries<typeof steps>

const fonts = {
	lexend: {
		typescale: {
			scale: {
				xs: steps[0],
				s: steps[1],
				m: steps[2],
				l: steps[3],
				xl: steps[4],
				xxl: steps[5],
				h4: steps[6],
				h3: steps[7]
			},
			steps
		}
	}
} as const

export const theme = createTheme({
	colors,
	fonts,
	gradients: {
		goldGradient: {
			2: {
				background: `linear-gradient(261.78deg, ${colors.cosmicGold[50]} 33.1%, ${colors.cosmicGold[90]} 56.3%,${colors.cosmicGold[100]} 65.78%, ${colors.gray[200]} 84.23%)`,
				inversedBackground: `linear-gradient(261.78deg, ${colors.cosmicGold[100]} 33.1%, ${colors.cosmicGold[90]} 56.3%, ${colors.cosmicGold[50]} 65.78%, ${colors.gray[200]} 84.23%)`,
				steps: [
					colors.cosmicGold[50],
					colors.cosmicGold[90],
					colors.cosmicGold[100],
					colors.gray[200]
				]
			},
			3: {
				background: `linear-gradient(270.62deg, ${colors.cosmicGold[50]} 2.88%, ${colors.cosmicGold[90]} 79.48%, ${colors.cosmicGold[100]} 98.1%)`,
				inversedBackground: `linear-gradient(270.62deg, ${colors.cosmicGold[100]} 2.88%,${colors.cosmicGold[90]} 79.48%, ${colors.cosmicGold[50]} 98.1%)`,
				steps: [colors.cosmicGold[50], colors.cosmicGold[90], colors.cosmicGold[100]]
			}
		},
		buttonGradients: {
			cta1: {
				background: `radial-gradient(100% 68.86% at 100% 100%, ${colors.cosmicGold[50]} 0%, ${colors.cosmicGold[100]} 50.19%, ${colors.cosmicGold[200]} 100%)`
			},
			cta2: {
				background: `radial-gradient(137.88% 94.94% at 100% 100%, ${colors.cosmicGold[50]} 0%, ${colors.cosmicGold[100]} 50%, ${colors.cosmicGold[200]} 100%), linear-gradient(0deg, ${colors.alpha.softGray1}, ${colors.alpha.softGray1})`
			},
			cta3: {
				background: `radial-gradient(251.21% 172.98% at 100% 100%, ${colors.cosmicGold[50]} 0%, ${colors.cosmicGold[100]} 50%, ${colors.cosmicGold[200]} 100%), linear-gradient(0deg, ${colors.alpha.softGray2}, ${colors.alpha.softGray2})`
			}
		}
	},
	sizes: {
		button: {
			small: {
				width: 120,
				height: 40,
				fontSize: 14,
				radius: 8,
				padding: "0.5rem 0.75rem"
			},
			default: {
				width: 165,
				height: 52,
				fontSize: 16,
				radius: 8,
				padding: "0.75rem 1rem"
			},
			large: {
				width: 200,
				height: 60,
				fontSize: 18,
				radius: 8,
				padding: "1rem 1.25rem"
			}
		}
	}
} as const)

/**
 * TEST
 */

// type ColorValue = string

// type ColorGroup = {
// 	[key: string | number]: ColorValue
// }

// type ColorObject = {
// 	[key: string]: ColorGroup | ColorValue
// }

// type ColorFormat = "rgb" | "rgba" | "hex" | "hsl"

// interface ColorFormatFunctions {
// 	rgb: () => string
// 	rgba: () => string
// 	hex: () => string
// 	hsl: () => string
// 	oklch: () => string
// }

// type ProxyColorGroup<CG extends ColorGroup> = {
// 	[K in keyof CG]: ColorFormatFunctions
// }

// type ProxyColorObject<CO extends ColorObject> = {
// 	[K in keyof CO]: CO[K] extends ColorValue
// 		? ColorFormatFunctions
// 		: CO[K] extends ColorGroup
// 			? ProxyColorGroup<CO[K]>
// 			: any
// }

// function createColorProxy<CO extends ColorObject>(colors: CO): ProxyColorObject<CO> {
// 	const handler: ProxyHandler<ColorObject> = {
// 		get(target: ColorObject, prop: string) {
// 			const value = target[prop]

// 			if (typeof value === "string") {
// 				return createColorFunctions(value)
// 			}

// 			if (typeof value === "object") {
// 				return new Proxy(value, {
// 					get(groupTarget: ColorGroup, groupProp: string) {
// 						const groupValue = groupTarget[groupProp]
// 						if (typeof groupValue === "string") {
// 							return createColorFunctions(groupValue)
// 						}
// 						return groupValue
// 					}
// 				})
// 			}

// 			return value
// 		}
// 	}

// 	return new Proxy(colors, handler) as unknown as ProxyColorObject<CO>
// }

// function createColorFunctions(color: string): ColorFormatFunctions {
// 	return {
// 		rgb: () => convertToRGB(color),
// 		rgba: () => color,
// 		hex: () => convertToHex(color),
// 		hsl: () => convertToHSL(color)
// 	}
// }

// function convertToRGB(rgba: string): string {
// 	const [r, g, b] = (rgba.match(/\d+/g) ?? [0, 0, 0]).map(Number)
// 	return `rgb(${r}, ${g}, ${b})`
// }

// function convertToHex(rgba: string): string {
// 	const [r, g, b] = (rgba.match(/\d+/g) ?? [0, 0, 0]).map(Number)
// 	return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
// }

// function convertToHSL(rgba: string): string {
// 	const matches = rgba.match(/\d+/g)
// 	if (!matches) return "hsl(0, 0%, 0%)"
// 	const [r, g, b] = matches.map((x) => Number(x)).map((x) => x / 255)

// 	const max = Math.max(r, g, b)
// 	const min = Math.min(r, g, b)
// 	let h = (max + min) / 2
// 	let s = (max + min) / 2
// 	const l = (max + min) / 2

// 	if (max === min) {
// 		h = s = 0
// 	} else {
// 		const d = max - min
// 		s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
// 		switch (max) {
// 			case r:
// 				h = (g - b) / d + (g < b ? 6 : 0)
// 				break
// 			case g:
// 				h = (b - r) / d + 2
// 				break
// 			case b:
// 				h = (r - g) / d + 4
// 				break
// 		}
// 		h! /= 6
// 	}

// 	return `hsl(${Math.round(h! * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
// }

// const proxyColors = createColorProxy(colors)

// // Usage example:
// console.log(proxyColors.gray[50].oklch()) // "#f6f6f6"
// console.log(proxyColors.cosmicGold[100].rgb()) // "rgb(219, 149, 49)"
// console.log(proxyColors.cosmicGold[50].hex()) // "hsl(0, 0%, 97%)"
