const colors = {
	gray: {
		"50": "oklch(97.315% 0 0)",
		"100": "oklch(92.797% 0 0)",
		"200": "oklch(86.069% 0 0)",
		"500": "oklch(53.476% 0 0)",
		"800": "oklch(39.042% 0 0)",
		"900": "oklch(36.002% 0 0)",
		"950": "oklch(14.479% 0 0)"
	},
	cosmicGold: {
		"50": "oklch(91.642% 0.15696 98.188)",
		"90": "oklch(73.683% 0.13788 73.881)",
		"100": "oklch(72.311% 0.13818 71.166)",
		"200": "oklch(59.222% 0.10877 74.108)"
	},
	spaceBlue: "oklch(97.315% 0 0 / 0.56)"
}

const newColors = {}
// for (const key in colors) {
// 	if (!newColors[key]) {
// 		newColors[key] = {}
// 	}
// 	if (typeof colors[key] === "string" || typeof colors[key] === "number") {
// 		newColors[key] = new Color(colors[key]).to("oklch").toString({ format: "oklch" })
// 	}
// 	if (typeof colors[key] === "object") {
// 		for (const shade in colors[key]) {
// 			newColors[key][shade] = new Color(colors[key][shade]).to("oklch").toString({
// 				format: "oklch"
// 			})
// 		}
// 	}
// }

console.log(newColors)
