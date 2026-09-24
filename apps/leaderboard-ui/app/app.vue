<script lang="ts" setup>
const title = "ZekoBoom Leaderboard"
const description = "ZekoBOOM contest on the legacy Zeko-M testnet"
const url = "https://zekoboom.zeko.io"
const image = `${url}/og-image.png`
const imageAlt = "Zeko Logo on a black background."
useHead({
	title,
	htmlAttrs: { lang: "en" },
	meta: [
		{ property: "apple-mobile-web-app-title", content: title },
		{ name: "description", content: description },
		{ property: "og:title", content: title },
		{ property: "og:site_name", content: title },
		{ property: "og:description", content: description },
		{ property: "og:url", content: url },
		{ property: "og:image", content: image },
		{ property: "og:image:url", content: image },
		{ property: "og:image:secure_url", content: image },
		{ property: "og:image:alt", content: imageAlt },
		{ property: "twitter:card", content: "summary_large_image" },
		{ property: "twitter:title", content: title },
		{ property: "twitter:url", content: url },
		{ property: "twitter:domain", content: "zeko.io" },
		{ property: "twitter:description", content: description },
		{ property: "twitter:image", content: image },
		{ property: "twitter:image:alt", content: imageAlt },
		{ property: "twitter:creator", content: "@ZekoLabs" },
		{ property: "twitter:site", content: "@ZekoLabs" }
	],
	link: [
		{ rel: "icon", href: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
		{
			rel: "icon",
			href: "/favicon-96x96.png",
			sizes: "96x96",
			type: "image/png"
		},
		{ rel: "icon shortcut", href: "/favicon.ico", sizes: "48x48" },
		{
			rel: "apple-touch-icon",
			sizes: "180x180",
			href: "/apple-touch-icon.png"
		},
		{ rel: "manifest", href: "/site.webmanifest" }
	]
})
</script>
<template>
  <NuxtLayout> <NuxtPage /> </NuxtLayout>
</template>
