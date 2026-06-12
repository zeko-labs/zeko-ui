<script lang="ts" setup>
const title = "Zeko Ops"
const description = "Zeko operations dashboard"

useHead({
	htmlAttrs: { lang: "en" },
	title,
	meta: [
		{ name: "description", content: description },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:site_name", content: title }
	]
})
</script>

<template>
  <NuxtPage />
</template>
