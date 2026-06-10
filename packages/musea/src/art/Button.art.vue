<script setup lang="ts">
defineArt("../../../layer/app/components/Button.vue", {
	title: "Button",
	category: "Layer",
	status: "trial",
	tags: ["button", "design-system", "layer"]
})
</script>

<art>
  <variant name="Default" default>
    <Button>Default</Button>
  </variant>

  <variant name="CTA 1">
    <Button variant="cta1">Connect Wallet</Button>
  </variant>

  <variant name="CTA 2">
    <Button variant="cta2">Send</Button>
  </variant>

  <variant name="CTA 3">
    <Button variant="cta3">Claim</Button>
  </variant>

  <variant name="Main">
    <Button variant="main">Main</Button>
  </variant>

  <variant name="Cancel">
    <Button variant="cancel">Cancel</Button>
  </variant>

  <variant name="Disabled">
    <Button variant="cta1" disabled>Disabled</Button>
  </variant>
</art>
