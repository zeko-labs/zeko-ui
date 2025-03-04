<script lang="ts" setup>
const content = [
	{
		title: "Cross-Chain",
		body: "Zeko redefines blockchain scalability with recursive proofs: developers can prove and bridge any computation across blockchains, app-chains, roll-ups, or zkVMs",
		link: "https://www.youtube.com/watch?v=rRwG8WkZYBE"
	},
	{
		title: "Evolved Rollups",
		body: "Zeko is isomorphic to Mina, giving developers access to enterprise-grade cryptography, fast state verification, zkProof APIs, UTXO model, and a browser ultralight client",
		link: "https://docs.minaprotocol.com/zkapps/o1js"
	},
	{
		title: "Future-Forward",
		body: "Putting zero-knowledge tools in developers' hands revolutionizes blockchain innovation, opening up endless design possibilities and market opportunities",
		link: "https://medium.com/zekoprotocol/introducing-zeko-protocol-mvp-empowering-ambitious-developers-to-scale-your-apps-with-typescript-3ea1fc514ae2"
	}
]
</script>
<template>
  <div class="background">
    <img
      src="~/assets/images/features2/background.webp"
      alt="Features background"
      class="background-image"
      loading="lazy"
    />
    <div class="Container">
      <Features2Column
        v-for="item of content"
        :key="item.title"
        v-bind="item"
      />
    </div>
  </div>
</template>

<style lang="postcss" scoped>
h2, p {
    margin: 0;
}

.background {
    position: relative;
    height: 100%;
    overflow: hidden;
}

.background-image {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    object-fit: cover;
    z-index: 0;
}

.Container {
    position: relative;
    z-index: 1;
    display: flex;
    padding: 6rem 4rem;
    align-items: center;
    gap: 2.5rem;
    align-self: stretch;
}
@media (max-width: 1024px) {
    .Container {
        flex-direction: column;
        align-items: flex-start;
        padding: 6rem 1rem;
    }
}
</style>
