<script setup lang="ts">
defineArt("../../../layer/app/components/FooterSocial.vue", {
	title: "FooterSocial",
	category: "Layer",
	status: "trial",
	tags: ["footer", "social", "design-system", "layer"]
})
</script>

<art>
  <variant name="Default" default>
    <div class="SocialPreview">
      <FooterSocial />
    </div>
  </variant>
</art>

<style scoped>
.SocialPreview {
  display: inline-flex;
  align-items: center;
  gap: 1rem;
}
</style>
