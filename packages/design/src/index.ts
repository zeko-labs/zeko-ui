import { defineConfig } from "@hebilicious/cssforge"

export const config = defineConfig({
	spacing: {
		custom: {
			size: {
				value: {
					1: "0.25rem",
					2: "0.5rem",
					3: "0.75rem",
					4: "0.8755rem",
					5: "1rem",
					6: "1.25rem"
				}
			}
		}
	},
	typography: {
		fluid: {
			lexend: {
				value: {
					minWidth: 320,
					minFontSize: 14,
					minTypeScale: 1.25,
					maxWidth: 1435,
					maxFontSize: 16,
					maxTypeScale: 1.25,
					positiveSteps: 7,
					negativeSteps: 2,
					labelStyle: "utopia"
				},
				settings: {
					customLabel: {
						"-2": "xs",
						"-1": "s",
						"0": "m",
						"1": "l",
						"2": "xl",
						"3": "xxl",
						"4": "h4",
						"5": "h3",
						"6": "h2",
						"7": "h1"
					}
				}
			}
		},
		weight: {
			lexend: {
				value: {
					regular: "400",
					medium: "500",
					semibold: "600"
				}
			}
		}
	},
	colors: {
		palette: {
			value: {
				basic: {
					white: { oklch: "oklch(100% 0 0)" },
					black: { oklch: "oklch(0% 0 0)" },
					spaceBlue: "oklch(97.315% 0 0 / 0.56)"
				},
				alpha: {
					"soft-gray1": "oklch(14.48% 0 0 / 12%)",
					"soft-gray2": "oklch(14.48% 0 0 / 24%)"
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
					light: "hsla(50, 100%, 67%, 1)",
					medium: "hsla(42, 87%, 48%, 1)",
					dark: "hsla(36, 62%, 40%, 1)"
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
				error: {
					background: "oklch(89.1% 0.042 21.6)",
					border: "oklch(81.6% 0.073 24)",
					content: "oklch(48.2% 0.153 28.2)"
				}
			}
		},
		gradients: {
			value: {
				goldGradient: {
					value: {
						// background: linear-gradient(251deg, #FFE459 33.63%, #DD9B34 55.54%, #DB9531 64.51%, #A47327 81.94%);
						1: {
							value:
								"linear-gradient(251deg, var(--1) 33.63%, var(--2) 55.54%, var(--3) 64.51%, var(--4) 81.94%)",
							variables: {
								1: "palette.value.cosmicGold.50",
								2: "palette.value.cosmicGold.90",
								3: "palette.value.cosmicGold.100",
								4: "palette.value.cosmicGold.200"
							}
						},
						// linear-gradient(262deg, #FFE459 33.1%, #DD9B34 56.3%, #DB9531 65.78%, #A47327 84.23%);
						2: {
							value:
								"linear-gradient(261.78deg, var(--1) 33.1%, var(--2) 56.3%, var(--3) 65.78%, var(--4) 84.23%)",
							variables: {
								1: "palette.value.cosmicGold.50",
								2: "palette.value.cosmicGold.90",
								3: "palette.value.cosmicGold.100",
								4: "palette.value.gray.200"
							}
						},
						// linear-gradient(271deg, #FFE459 2.88%, #DD9B34 79.48%, #DB9531 98.1%);
						3: {
							value: "linear-gradient(270.62deg, var(--1) 2.88%, var(--2) 79.48%, var(--3) 98.1%)",
							variables: {
								1: "palette.value.cosmicGold.50",
								2: "palette.value.cosmicGold.90",
								3: "palette.value.cosmicGold.100"
							}
						},
						"3-inversed": {
							value: "linear-gradient(270.62deg, var(--1) 2.88%, var(--2) 79.48%, var(--3) 98.1%)",
							variables: {
								1: "palette.value.cosmicGold.100",
								2: "palette.value.cosmicGold.90",
								3: "palette.value.cosmicGold.50"
							}
						},
						// background: linear-gradient(0deg, var(--Primary-Cosmic-Gold-Dark, #A47327) -37.5%, var(--Primary-Cosmic-Gold-Medium, #E5A40F) 50.22%, var(--Primary-Cosmic-Gold-Light, #FFE459) 121.15%);
						"button-main": {
							value: "linear-gradient(0deg, var(--1) -37.5%, var(--2) 50.22%, var(--3) 121.15%)",
							variables: {
								1: "palette.value.cosmicGold.dark",
								2: "palette.value.cosmicGold.medium",
								3: "palette.value.cosmicGold.light"
							}
						},
						// radial-gradient(68.86% 100% at 100% 100%, #FFE459 0%, #DB9531 50.19%, #A47327 100%);
						"button-cta-1": {
							value:
								"radial-gradient(100% 68.86% at 100% 100%, var(--1) 0%, var(--2) 50.19%, var(--3) 100%)",
							variables: {
								1: "palette.value.cosmicGold.50",
								2: "palette.value.cosmicGold.100",
								3: "palette.value.cosmicGold.200"
							}
						},
						// linear-gradient(0deg, rgba(10, 10, 10, 0.12) 0%, rgba(10, 10, 10, 0.12) 100%), radial-gradient(94.94% 137.88% at 100% 100%, #FFE459 0%, #DB9531 50%, #A47327 100%);
						"button-cta-2": {
							value:
								"radial-gradient(137.88% 94.94% at 100% 100%, var(--1) 0%, var(--2) 50%, var(--3) 100%), linear-gradient(0deg, var(--4), var(--4))",
							variables: {
								1: "palette.value.cosmicGold.50",
								2: "palette.value.cosmicGold.100",
								3: "palette.value.cosmicGold.200",
								4: "palette.value.alpha.soft-gray1"
							}
						},
						// linear-gradient(0deg, rgba(10, 10, 10, 0.24) 0%, rgba(10, 10, 10, 0.24) 100%), radial-gradient(172.98% 251.21% at 100% 100%, #FFE459 0%, #DB9531 50%, #A47327 100%);
						"button-cta-3": {
							value:
								"linear-gradient(0deg, var(--4), var(--4)), radial-gradient(172.98% 251.21% at 100% 100%, var(--1) 0%, var(--2) 50%, var(--3) 100%)",
							variables: {
								1: "palette.value.cosmicGold.50",
								2: "palette.value.cosmicGold.100",
								3: "palette.value.cosmicGold.200",
								4: "palette.value.alpha.soft-gray2"
							}
						}
					}
				}
			}
		},
		theme: {
			value: {
				light: {
					border: {
						value: {
							primary: "var(--1)",
							primaryDark: "var(--2)",
							secondary: "var(--3)"
						},
						variables: {
							1: "palette.value.gray.200",
							2: "palette.value.gray.700",
							3: "palette.value.gray.300"
						}
					},
					background: {
						value: {
							secondary: "var(--1)"
						},
						variables: {
							1: "palette.value.gray.100"
						}
					},
					content: {
						value: {
							primary: "var(--1)",
							secondary: "var(--2)",
							tertiary: "var(--3)",
							quaternary: "var(--4)",
							light: "var(--5)"
						},
						variables: {
							1: "palette.value.gray.950",
							2: "palette.value.gray.900",
							3: "palette.value.gray.700",
							4: "palette.value.gray.500",
							5: "palette.value.gray.50"
						}
					}
				}
			}
		}
	},
	primitives: {
		border: {
			value: {
				mainnetEra: {
					value: {
						background:
							"linear-gradient(white, white) padding-box, linear-gradient(90deg, var(--white) -26.02%, var(--gm) 19.61%, var(--g50) 48.48%, var(--g50) 81.9%, var(--white) 127.78%) border-box",
						border: "1px solid transparent"
					},
					variables: {
						white: "palette.value.basic.white",
						g50: "palette.value.cosmicGold.50",
						gm: "palette.value.cosmicGold.medium"
					}
				}
			}
		},
		"zeko-token": {
			value: {
				background: {
					value: { color: "var(--1)" },
					variables: { 1: "palette.value.cosmicGold.90" }
				},
				foreground: {
					value: { color: "var(--1)" },
					variables: { 1: "palette.value.basic.white" }
				}
			}
		},
		button: {
			value: {
				default: {
					value: {
						width: "135px",
						height: "40px",
						fontSize: "var(--t1)",
						fontWeight: "var(--t2)",
						radius: "var(--s2)",
						padding: "var(--s4) var(--s3)"
					},
					variables: {
						t1: "typography_fluid.lexend@m",
						t2: "typography.weight.lexend.value.regular",
						s2: "spacing.custom.size.value.2",
						s3: "spacing.custom.size.value.3",
						s4: "spacing.custom.size.value.4"
					}
				},
				cta: {
					value: {
						width: "165px",
						height: "52px",
						fontSize: "var(--t1)",
						fontWeight: "var(--t2)",
						radius: "var(--s2)",
						padding: "var(--s3) var(--s5)"
					},
					variables: {
						t1: "typography_fluid.lexend@m",
						t2: "typography.weight.lexend.value.medium",
						s2: "spacing.custom.size.value.2",
						s3: "spacing.custom.size.value.3",
						s5: "spacing.custom.size.value.5"
					}
				},
				large: {
					value: {
						width: "200px",
						height: "60px",
						fontSize: "var(--t1)",
						fontWeight: "var(--t2)",
						radius: "var(--s2)",
						padding: "var(--s5) var(--s6)"
					},
					variables: {
						t1: "typography_fluid.lexend@xl",
						t2: "typography.weight.lexend.value.medium",
						s2: "spacing.custom.size.value.2",
						s5: "spacing.custom.size.value.5",
						s6: "spacing.custom.size.value.6"
					}
				}
			}
		}
	}
})
