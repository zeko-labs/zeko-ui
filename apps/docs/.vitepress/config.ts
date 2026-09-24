import { defineConfig } from "vitepress"
import d2Plugin from "vitepress-plugin-d2"
import { type Config, Theme } from "vitepress-plugin-d2/dist/config"
import llmstxt from "vitepress-plugin-llms"
import { networkLabelsForLlms } from "./llmsNetworkLabels"

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: "Zeko Docs",
	description: "Zeko Ethereum rollup documentation: zkApps, ETH bridging, wallets, and settlement",
	srcDir: "content",
	vite: {
		plugins: [llmstxt({ stripHTML: false }), networkLabelsForLlms()]
	},
	markdown: {
		config: (md) => {
			md.use(d2Plugin, {
				scale: 1,
				padding: 16,
				theme: Theme.NEUTRAL_DEFAULT,
				darkTheme: Theme.DARK_MUAVE,
				sketch: true
			} satisfies Config)
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
		nav: [
			{ text: "Docs", link: "/introduction/what-is-zeko" },
			{ text: "Glossary", link: "/about/glossary" },
			{ text: "Website", link: "https://zeko.io", target: "_blank", rel: "noopener noreferrer" }
		],
		logo: { light: "/logo.svg", dark: "/logo-dark.svg" },
		sidebar: [
			{
				text: "Introduction",
				collapsed: false,
				items: [
					{ text: "What is Zeko?", link: "/introduction/what-is-zeko" },
					{ text: "Why Zeko?", link: "/introduction/why-zeko" },
					{ text: "Quick Start", link: "/introduction/quick-start" }
				]
			},
			{
				text: "Background Concepts",
				collapsed: false,
				items: [
					{ text: "Core Blockchain Concepts", link: "/background/core-blockchain-concepts" },
					{ text: "Smart Contracts", link: "/background/smart-contracts" },
					{ text: "Zero-Knowledge Proofs", link: "/background/zero-knowledge-proofs" },
					{ text: "Layer 2 Scaling Solutions", link: "/background/layer-2-scaling" },
					{ text: "Proof-System Heritage", link: "/background/mina-protocol" }
				]
			},
			{
				text: "Zeko Deep Dive",
				collapsed: false,
				items: [
					{ text: "Zeko Core Concepts", link: "/architecture/zeko-core-concepts" },
					{ text: "Technical Architecture", link: "/architecture/technical-architecture" },
					{ text: "Security Model", link: "/architecture/security-model" }
				]
			},
			{
				text: "Developing on Zeko (For Developers)",
				collapsed: true,
				items: [
					{ text: "Getting Started", link: "/developers/getting-started" },
					{
						text: "Guides & Tutorials",
						link: "/developers/guides-tutorials",
						collapsed: true,
						items: [
							{ text: "Custom Network", link: "/developers/guides/custom-network" }
						]
					},
					{
						text: "Tools",
						collapsed: true,
						items: [
							{ text: "Agent Skills", link: "/developers/tools/agent-skills" },
							{ text: "Base Bridge SDK", link: "/developers/tools/bridge-sdk" }
						]
					},
					{ text: "Examples & Boilerplates", link: "/developers/examples-boilerplates" },
					{ text: "API Reference", link: "/developers/api-reference" },
					{ text: "Contributing to Zeko Development", link: "/developers/contributing" }
				]
			},
			{
				text: "Using Zeko (For End Users)",
				collapsed: true,
				items: [
					{ text: "Getting Started", link: "/users/getting-started" },
					{
						text: "Guides & Tutorials",
						link: "/users/guides-tutorials",
						collapsed: true,
						items: [
							{ text: "Sending Tokens", link: "/users/guides/sending-tokens" },
							{ text: "Interacting with a Dapp", link: "/users/guides/dapp" },
							{ text: "Ethereum Bridge", link: "/users/guides/zeko-bridge" },
							{ text: "Zeko Explorer", link: "/users/guides/zekoscan-explorer" }
						]
					},

					{ text: "User Concepts Explained", link: "/users/user-concepts-explained" }
				]
			},
			{
				text: "Running Network Infrastructure (For Operators)",
				collapsed: true,
				items: [
					{ text: "Getting Started", link: "/operators/getting-started" },
					{
						text: "Guides & Tutorials",
						link: "/operators/guides-tutorials"
					},
					{ text: "Concepts for Operators", link: "/operators/concepts-for-operators" }
				]
			},
			{
				text: "Legacy Mina-backed Deployments",
				collapsed: true,
				items: [
					{
						text: "Legacy Operator Guides",
						link: "/operators/guides-tutorials#legacy-mina-backed-deployments"
					},
					{ text: "Legacy Bridge CLI", link: "/developers/tools/bridge-cli" },
					{ text: "Legacy Faucet CLI", link: "/developers/tools/faucet-cli" },
					{ text: "Legacy Faucet Tutorial", link: "/developers/guides/create-faucet" }
				]
			},
			{
				text: "About",
				collapsed: false,
				items: [
					{ text: "Glossary", link: "/about/glossary" },
					{ text: "Frequently Asked Questions (FAQ)", link: "/about/faq" },
					{ text: "Community & Support", link: "/about/community" }
				]
			}
		],
		socialLinks: [{ icon: "github", link: "https://github.com/zeko-labs" }],
		footer: {
			message: "Docs released under the MIT License.",
			copyright: "Copyright © 2025-present Zeko Labs"
		}
	}
})
