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
		sidebar: [
			{
				text: 'Introduction',
				link: '/introduction',
				items: [
					{ text: 'What is Zeko?', link: '/introduction#11-what-is-zeko' },
					{ text: 'Why Zeko?', link: '/introduction#12-why-zeko' },
					{ text: 'Quick Start (For Users & Developers)', link: '/introduction#13-quick-start-for-users--developers' },
					{ text: 'Who is this Documentation For?', link: '/introduction#14-who-is-this-documentation-for' }
				]
			},
			{
				text: 'Background Concepts',
				link: '/background',
				items: [
					{ text: 'Core Blockchain Concepts', link: '/background#21-core-blockchain-concepts' },
					{ text: 'Smart Contracts & EVM', link: '/background#22-smart-contracts--evm' },
					{ text: 'Zero-Knowledge Proofs (ZKPs)', link: '/background#23-zero-knowledge-proofs-zkps' },
					{ text: 'Layer 2 Scaling Solutions', link: '/background#24-layer-2-scaling-solutions' },
					{ text: 'Mina Protocol', link: '/background#25-mina-protocol' }
				]
			},
			{
				text: 'Zeko Architecture & Concepts',
				link: '/architecture',
				items: [
					{ text: 'Zeko Core Concepts', link: '/architecture#31-zeko-core-concepts' },
					{ text: 'Technical Architecture', link: '/architecture#32-technical-architecture' },
					{ text: 'Security Model', link: '/architecture#33-security-model' },
					{ text: 'Roadmap', link: '/architecture#34-roadmap' }
				]
			},
			{
				text: 'Using Zeko (For End Users)',
				link: '/users',
				items: [
					{ text: 'Getting Started', link: '/users#41-getting-started' },
					{ text: 'Performing Basic Transactions', link: '/users#42-performing-basic-transactions' },
					{ text: 'Zeko Bridge', link: '/users#43-zeko-bridge' },
					{ text: 'Zekoscan Explorer', link: '/users#44-zekoscan-explorer' },
					{ text: 'User Concepts Explained', link: '/users#45-user-concepts-explained' }
				]
			},
			{
				text: 'Developing on Zeko (For Developers)',
				link: '/developers',
				items: [
					{ text: 'Getting Started', link: '/developers#51-getting-started' },
					{ text: 'Core Developer Concepts', link: '/developers#52-core-developer-concepts' },
					{ text: 'Guides & Tutorials', link: '/developers#53-guides--tutorials' },
					{ text: 'Examples & Boilerplates', link: '/developers#54-examples--boilerplates' },
					{ text: 'API Reference', link: '/developers#55-api-reference' },
					{ text: 'Contributing to Zeko Development', link: '/developers#56-contributing-to-zeko-development' }
				]
			},
			{
				text: 'Running Network Infrastructure (For Operators)',
				link: '/operators',
				items: [
					{ text: 'Getting Started', link: '/operators#61-getting-started' },
					{ text: 'Guides', link: '/operators#62-guides' },
					{ text: 'Concepts for Operators', link: '/operators#63-concepts-for-operators' },
					{ text: 'Troubleshooting', link: '/operators#64-troubleshooting' }
				]
			},
			{
				text: 'Reference',
				link: '/reference',
				items: [
					{ text: 'Glossary', link: '/reference#71-glossary' },
					{ text: 'Frequently Asked Questions (FAQ)', link: '/reference#72-frequently-asked-questions-faq' },
					{ text: 'Troubleshooting Guide', link: '/reference#73-troubleshooting-guide' }
				]
			},
			{
				text: 'Community & Support',
				link: '/community'
			},
			{
				text: 'Changelog',
				link: '/changelog'
			}
		],

		socialLinks: [
			{ icon: "github", link: "https://github.com/zeko-labs" }
		],
		footer: {
			message: "Released under the MIT License.",
			copyright: "Copyright © 2025-present Zeko Labs"
		}
	}
})
