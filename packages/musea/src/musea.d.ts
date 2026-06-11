declare function defineArt(
	source: string,
	options: {
		title: string
		category?: string
		status?: string
		tags?: string[]
	}
): void

declare const onMounted: typeof import("vue").onMounted
declare const ref: typeof import("vue").ref

declare function useRuntimeConfig(): {
	public: {
		links: {
			docs: string
			zekoBoom: string
			zekoBridge: string
			zekoFaucet: string
		}
		socials: {
			discord: string
			github: string
			telegram: string
			twitter: string
		}
	}
}
