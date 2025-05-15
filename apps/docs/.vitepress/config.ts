import { defineConfig } from "vitepress"
import d2Plugin from "vitepress-plugin-d2"
import { type Config, Theme } from "vitepress-plugin-d2/dist/config"
import llmstxt from "vitepress-plugin-llms"

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: "Zeko Documentation",
	description: "Documentation for Zeko",
	vite: {
		plugins: [llmstxt()]
	},
	markdown: {
		config: (md) => {
			md.use(
				d2Plugin,
				{
					scale: 1,
					padding: 16,
					theme: Theme.NEUTRAL_DEFAULT,
					darkTheme: Theme.DARK_MUAVE,
					sketch: true
				} satisfies Config
			)
		}
	},
	head: [
		["link", { rel: "icon", type: "image/png", href: "/favicon-96x96.png", sizes: "96x96" }],
		["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
		["link", { rel: "shortcut icon", href: "/favicon.ico" }],
		["link", { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" }],
		["link", { rel: "manifest", href: "/site.webmanifest" }]
	],
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		search: {
			provider: "local",
			options: {
				detailedView: true
			}
		},
		nav: [],
		logo: "/logo.png",
		sidebar: {},

		socialLinks: [
			{ icon: "github", link: "https://github.com/zeko-labs" }
		],
		footer: {
			message: "Released under the MIT License.",
			copyright: "Copyright © 2025-present Zeko Labs"
		}
	}
})
