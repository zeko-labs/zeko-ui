<script lang="ts" setup>
const title = "Zeko"
const description = "Zeko is a zero-knowledge cross-chain scaling protocol"
const url = "https://zeko.io"
useSeoMeta({
	title,
	appleMobileWebAppTitle: title,
	description,
	ogTitle: title,
	ogUrl: url,
	ogDescription: description,
	ogImage: "/og-image.png",
	twitterTitle: title,
	twitterDescription: description,
	twitterImage: "/og-image.png",
	twitterCard: "summary"
})

useHead({
	htmlAttrs: { lang: "en" },
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
