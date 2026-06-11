<script setup lang="ts">
const navigation = {
	name: "Build",
	children: [
		{ name: "Docs", url: "https://docs.zeko.io" },
		{ name: "Faucet", url: "https://faucet.zeko.io" },
		{ name: "Bridge", url: "https://bridge.zeko.io" }
	]
}

defineArt("../../../layer/app/components/Navigation/Item.vue", {
	title: "NavigationItem",
	category: "Layer",
	status: "trial",
	tags: ["navigation", "menu", "design-system", "layer"]
})
</script>

<art>
  <variant name="Default" default>
    <NavigationItem :navigation="navigation" />
  </variant>
</art>
