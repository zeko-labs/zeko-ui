<script setup lang="ts">
defineArt("../../../layer/app/components/Navigation/Index.vue", {
	title: "Navigation",
	category: "Layer",
	status: "trial",
	tags: ["navigation", "header", "design-system", "layer"]
})
</script>

<art>
  <variant name="Default" default>
    <div class="NavigationPreview">
      <NavigationIndex />
    </div>
  </variant>

  <variant name="No logo">
    <div class="NavigationPreview">
      <NavigationIndex :logo="false" />
    </div>
  </variant>
</art>

<style scoped>
.NavigationPreview {
  width: min(64rem, 100vw);
  background: var(--theme-light-background-primary);
}
</style>
