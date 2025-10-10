import { createTheme } from "./themer"

type Colors = {
	[key: string]: string | Colors
}

const colors = {
	white: "oklch(100% 0 0)",
	black: "oklch(0% 0 0)",
	alpha: {
		softGray1: "oklch(14.48% 0 0 / 12%)",
		softGray2: "oklch(14.48% 0 0 / 24%)"
	},
	gray: {
		50: "oklch(97.315% 0 0)",
		100: "oklch(92.797% 0 0)",
		200: "oklch(86.069% 0 0)",
		300: "oklch(75.7% 0 0)",
		400: "oklch(62.7% 0 0)",
		500: "oklch(53.476% 0 0)",
		600: "oklch(47.8% 0 0)",
		700: "oklch(42.8% 0 0)",
		800: "oklch(39.042% 0 0)",
		900: "oklch(36.002% 0 0)",
		950: "oklch(14.479% 0 0)"
	},
	cosmicGold: {
		50: "oklch(91.642% 0.15696 98.188)",
		90: "oklch(73.683% 0.13788 73.881)",
		100: "oklch(72.311% 0.13818 71.166)",
		200: "oklch(59.222% 0.10877 74.108)",
		medium: "oklch(76.12% 0.1554 79.54)"
	},
	yellow: {
		50: "oklch(97.7% 0.016 99)",
		100: "oklch(94.3% 0.041 98.1)",
		200: "oklch(88.9% 0.079 96.6)",
		300: "oklch(81.8% 0.114 93.6)",
		400: "oklch(75.2% 0.13 87.9)",
		500: "oklch(69.2% 0.124 83.1)",
		600: "oklch(59.2% 0.109 74.1)",
		700: "oklch(49.5% 0.091 64.9)"
	},
	blue: {
		50: "oklch(97.5% 0.013 244.3)",
		100: "oklch(94.2% 0.028 248.1)",
		200: "oklch(90% 0.05 246.5)",
		300: "oklch(83.8% 0.083 245.6)",
		400: "oklch(76% 0.121 248.4)",
		500: "oklch(67.7% 0.157 256)",
		600: "oklch(59.9% 0.183 261.2)",
		700: "oklch(51.7% 0.179 263.6)",
		800: "oklch(46.7% 0.156 264.5)",
		900: "oklch(41.2% 0.118 263.4)",
		950: "oklch(30% 0.077 266.7)"
	},
	persianRed: {
		50: "oklch(97.1% 0.01 17.3)",
		100: "oklch(94% 0.021 21.2)",
		200: "oklch(89.1% 0.042 21.6)",
		300: "oklch(81.6% 0.073 24)",
		400: "oklch(71.1% 0.122 24.3)",
		500: "oklch(62.4% 0.161 26.8)",
		600: "oklch(55.3% 0.173 28)",
		700: "oklch(48.2% 0.153 28.2)",
		800: "oklch(42.7% 0.127 28)",
		900: "oklch(42.7% 0.127 28)",
		950: "oklch(24.9% 0.071 26.2)"
	},
	pending: {
		background: "oklch(94.6% 0.029 67.5)",
		border: "oklch(87.2% 0.073 67.3)",
		content: "oklch(64% 0.148 57.8)"
	},
	complete: {
		background: "oklch(95.9% 0.021 156.8)",
		border: "oklch(87.5% 0.064 155.7)",
		content: "oklch(64.1% 0.142 150.6)"
	},
	spaceBlue: "oklch(97.315% 0 0 / 0.56)"
} as const satisfies Colors

// --step--2: clamp(0.56rem, 0.537rem + 0.1148vw, 0.64rem);
// --step--1: clamp(0.7rem, 0.6713rem + 0.1435vw, 0.8rem);
// --step-0: clamp(0.875rem, 0.8391rem + 0.1794vw, 1rem);
// --step-1: clamp(1.0938rem, 1.0489rem + 0.2242vw, 1.25rem);
// --step-2: clamp(1.3672rem, 1.3111rem + 0.2803vw, 1.5625rem);
// --step-3: clamp(1.709rem, 1.6389rem + 0.3503vw, 1.9531rem);
// --step-4: clamp(2.1362rem, 2.0486rem + 0.4379vw, 2.4414rem);
// --step-5: clamp(2.6703rem, 2.5608rem + 0.5474vw, 3.0518rem);
// --step-6: clamp(3.3379rem, 3.201rem + 0.6843vw, 3.8147rem);
// --step-7: clamp(4.1723rem, 4.0013rem + 0.8553vw, 4.7684rem);

const steps = [
	"clamp(0.56rem, 0.537rem + 0.1148vw, 0.64rem)",
	"clamp(0.7rem, 0.6713rem + 0.1435vw, 0.8rem)",
	"clamp(0.875rem, 0.8391rem + 0.1794vw, 1rem)",
	"clamp(1.0938rem, 1.0489rem + 0.2242vw, 1.25rem)",
	"clamp(1.3672rem, 1.3111rem + 0.2803vw, 1.5625rem)",
	"clamp(1.709rem, 1.6389rem + 0.3503vw, 1.9531rem)",
	"clamp(2.1362rem, 2.0486rem + 0.4379vw, 2.4414rem)",
	"clamp(2.6703rem, 2.5608rem + 0.5474vw, 3.0518rem)",
	"clamp(3.3379rem, 3.201rem + 0.6843vw, 3.8147rem)",
	"clamp(4.1723rem, 4.0013rem + 0.8553vw, 4.7684rem)"
] as const

const fonts = {
	lexend: {
		typescale: {
			weight: {
				regular: "400",
				medium: "500",
				semibold: "600"
			},
			scale: {
				xs: steps[0],
				s: steps[1],
				m: steps[2],
				l: steps[3],
				xl: steps[4],
				xxl: steps[5],
				h4: steps[6],
				h3: steps[7],
				h2: steps[8],
				h1: steps[9]
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
			// background: linear-gradient(251deg, #FFE459 33.63%, #DD9B34 55.54%, #DB9531 64.51%, #A47327 81.94%);
			1: {
				background: `background: linear-gradient(251deg, ${colors.cosmicGold[50]} 33.63%, ${colors.cosmicGold[90]} 55.54%, ${colors.cosmicGold[100]} 64.51%, ${colors.cosmicGold[200]} 81.94%);`,
				steps: [
					colors.cosmicGold[50],
					colors.cosmicGold[90],
					colors.cosmicGold[100],
					colors.cosmicGold[200]
				]
			},
			// linear-gradient(262deg, #FFE459 33.1%, #DD9B34 56.3%, #DB9531 65.78%, #A47327 84.23%);
			2: {
				background: `linear-gradient(261.78deg, ${colors.cosmicGold[50]} 33.1%, ${colors.cosmicGold[90]} 56.3%, ${colors.cosmicGold[100]} 65.78%, ${colors.cosmicGold[200]} 84.23%)`,
				steps: [
					colors.cosmicGold[50],
					colors.cosmicGold[90],
					colors.cosmicGold[100],
					colors.gray[200]
				]
			},
			// linear-gradient(271deg, #FFE459 2.88%, #DD9B34 79.48%, #DB9531 98.1%);
			3: {
				background: `linear-gradient(270.62deg, ${colors.cosmicGold[50]} 2.88%, ${colors.cosmicGold[90]} 79.48%, ${colors.cosmicGold[100]} 98.1%)`,
				inversedBackground: `linear-gradient(270.62deg, ${colors.cosmicGold[100]} 2.88%,${colors.cosmicGold[90]} 79.48%, ${colors.cosmicGold[50]} 98.1%)`,
				steps: [colors.cosmicGold[50], colors.cosmicGold[90], colors.cosmicGold[100]]
			}
		},
		border: {
			// background: linear-gradient(white, white) padding-box, linear-gradient(90deg, white -26.02%, var(--colors-cosmicGold-medium, #e5a40f) 19.61%, var(--colors-cosmicGold-50, #ffe459) 48.48%, var(--colors-cosmicGold-50, #e5a40f) 81.9%,white 127.78%) border-box;border: 1px solid transparent;
			mainnetEra: {
				background: `linear-gradient(white, white) padding-box, linear-gradient(90deg, ${colors.white} -26.02%, ${colors.cosmicGold.medium} 19.61%, ${colors.cosmicGold[50]} 48.48%, ${colors.cosmicGold[50]} 81.9%, ${colors.white} 127.78%) border-box`,
				border: "1px solid transparent"
			}
		},
		buttonGradients: {
			// radial-gradient(68.86% 100% at 100% 100%, #FFE459 0%, #DB9531 50.19%, #A47327 100%);
			cta1: {
				background: `radial-gradient(100% 68.86% at 100% 100%, ${colors.cosmicGold[50]} 0%, ${colors.cosmicGold[100]} 50.19%, ${colors.cosmicGold[200]} 100%)`
			},
			// linear-gradient(0deg, rgba(10, 10, 10, 0.12) 0%, rgba(10, 10, 10, 0.12) 100%), radial-gradient(94.94% 137.88% at 100% 100%, #FFE459 0%, #DB9531 50%, #A47327 100%);
			cta2: {
				background: `radial-gradient(137.88% 94.94% at 100% 100%, ${colors.cosmicGold[50]} 0%, ${colors.cosmicGold[100]} 50%, ${colors.cosmicGold[200]} 100%), linear-gradient(0deg, ${colors.alpha.softGray1}, ${colors.alpha.softGray1})`
			},
			// linear-gradient(0deg, rgba(10, 10, 10, 0.24) 0%, rgba(10, 10, 10, 0.24) 100%), radial-gradient(172.98% 251.21% at 100% 100%, #FFE459 0%, #DB9531 50%, #A47327 100%);
			cta3: {
				background: `linear-gradient(0deg, ${colors.alpha.softGray2}, ${colors.alpha.softGray2}), radial-gradient(172.98% 251.21% at 100% 100%, ${colors.cosmicGold[50]} 0%, ${colors.cosmicGold[100]} 50%, ${colors.cosmicGold[200]} 100%)`
			}
		}
	},
	semantic: {
		border: {
			primary: colors.gray[200],
			primaryDark: colors.gray[700],
			secondary: colors.gray[300]
		},
		background: {
			secondary: colors.gray[100]
		},
		content: {
			secondary: colors.gray[700],
			tertiary: colors.gray[900]
		}
	},
	sizes: {
		button: {
			default: {
				width: "8.438rem",
				height: "2.5rem",
				fontSize: fonts.lexend.typescale.scale.m,
				fontWeight: fonts.lexend.typescale.weight.regular,
				radius: "0.5rem",
				padding: "0.8755rem 0.75rem"
			},
			cta: {
				width: "10.313rem",
				height: "3.25rem",
				fontSize: fonts.lexend.typescale.scale.m,
				fontWeight: fonts.lexend.typescale.weight.medium,
				radius: "0.5rem",
				padding: "0.75rem 1rem"
			},
			large: {
				width: "12.5rem",
				height: "3.75rem",
				fontSize: fonts.lexend.typescale.scale.xl,
				fontWeight: fonts.lexend.typescale.weight.medium,
				radius: "0.5rem",
				padding: "1rem 1.25rem"
			}
		}
	}
} as const)

// type Prettify<T> = {
// 	[K in keyof T]: T[K]
// } & {}

// type SizeEntry<E extends string, Index extends number> = [`size-${Index}`, E]

// //@ts-expect-error number => number & I
// type ScaleEntries<A extends readonly string[]> = { [I in keyof A]: Prettify<SizeEntry<A[I], I>> }

// const typeSafeObjectFromEntries = <const T extends ReadonlyArray<readonly [PropertyKey, unknown]>>(
// 	entries: T
// ): { [K in T[number] as K[0]]: K[1] } => {
// 	return Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] }
// }

// const entries = steps.map(
// 	(step, index) => [`size-${index}` as const, step] as const
// ) as unknown as ScaleEntries<typeof steps>

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
