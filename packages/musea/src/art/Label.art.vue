<script setup lang="ts">
defineArt("../../../layer/app/components/Label.vue", {
	title: "Label",
	category: "Layer",
	status: "trial",
	tags: ["status", "design-system", "layer"]
})
</script>

<art>
  <variant name="Pending" default>
    <Label is="pending" />
  </variant>

  <variant name="Complete">
    <Label is="complete" />
  </variant>

  <variant name="Cancelled">
    <Label is="cancelled" />
  </variant>

  <variant name="Error">
    <Label is="error" />
  </variant>
</art>
