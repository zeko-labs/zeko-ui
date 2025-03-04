<script lang="ts" setup>
const title = "Zeko"
const description = "Zeko is a zero-knowledge cross-chain scaling protocol"
const url = "https://zeko.io"

useHead({
	htmlAttrs: { lang: "en" },
	meta: [
		{ property: "og:title", content: title },
		{ property: "apple-mobile-web-app-title", content: title },
		{ name: "description", content: description },
		{ property: "og:description", content: description },
		{ property: "og:url", content: url },
		{ property: "og:image", content: "/og-image.jpg" },
		{ property: "og:image:url", content: "/og-image.jpg" },
		{ property: "og:image:secure_url", content: "/og-image.jpg" },
		{ property: "twitter:title", content: title },
		{ property: "twitter:description", content: description },
		{ property: "twitter:image", content: "/og-image.jpg" },
		{ property: "twitter:creator", content: "@ZekoLabs" },
		{ property: "twitter:card", content: "summary_large_image" }
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
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
