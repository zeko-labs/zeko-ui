<script lang="ts" setup>
const content = [
	{
		title: "Cross-Chain",
		body: "Zeko redefines blockchain scalability with recursive proofs: developers can prove and bridge any computation across blockchains, app-chains, roll-ups, or zkVMs >>",
		link: "https://www.youtube.com/watch?v=rRwG8WkZYBE"
	},
	{
		title: "Evolved Rollups",
		body: "Zeko is isomorphic to Mina, giving developers access to enterprise-grade cryptography, fast state verification, zkProof APIs, UTXO model, and a browser ultralight client >>",
		link: "https://docs.minaprotocol.com/zkapps/o1js"
	},
	{
		title: "Future-Forward",
		body: "Putting zero-knowledge tools in developers' hands revolutionizes blockchain innovation, opening up endless design possibilities and market opportunities >>",
		link: "https://medium.com/zekoprotocol/introducing-zeko-protocol-mvp-empowering-ambitious-developers-to-scale-your-apps-with-typescript-3ea1fc514ae2"
	}
]
</script>
<template>
  <div class="background">
    <div class="columns-container">
      <div class="column" v-for="item of content" :key="item.title">
        <h2 class="column-title">{{ item.title }}</h2>
        <p class="column-text">
          {{ item.body }}
        </p>
        <div class="circle-link">
          <a :href="item.link" target="_blank">
            <img
              src="~/assets/images/circle_link.png"
              alt="Cross-Chain link"
              class="circle-image">
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
h2, p {
    margin: 0;
}

.background {
    background-image: url("~/assets/images/features_2.png");
    background-size: cover;
    height: 100%;
}
.column {
    display: grid;
    gap: 1rem;
}

.columns-container {
    display: flex;
    padding: 6rem 4rem;
    align-items: center;
    gap: 2.5rem;
    align-self: stretch;
}

.column-title {
    font-size: var(--fonts-lexend-typescale-scale-xxl);
    font-weight: 500;
}

.column-text {
    font-weight: 400;
}

.circle-link {
    padding-top: 1rem;
}

img:hover {
    transform: scale(1.1);
    transition: transform 0.3s;
    filter: hue-rotate(170deg) saturate(200%);
}
</style>
