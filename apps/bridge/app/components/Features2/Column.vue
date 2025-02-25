<script lang="ts" setup>
const { title, body, link } = defineProps<{
	title: string
	body: string
	link: string
}>()
</script>
<template>
  <div class="column" :key="title">
    <h2 class="column-title">{{ title }}</h2>
    <p class="column-text">
      {{ body }}
    </p>
    <div class="circle-link" :data-item="title">
      <a
        :ref="title"
        :href="link"
        target="_blank">
        <img
          class="Hovered"
          src="~/assets/images/features2/circle_link2.svg"
          alt="Cross-Chain link">

        <img
          class="NotHovered"
          src="~/assets/images/features2/circle_link1.svg"
          alt="Cross-Chain link">
      </a>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
h2, p {
    margin: 0;
}


.column {
    display: grid;
    gap: 1rem;
}


.column-title {
    font-size: var(--fonts-lexend-typescale-scale-xxl);
    font-weight: 500;
}

.column-text {
    font-weight: 400;
    text-wrap: balance;
}

.circle-link {
    padding-top: 1rem;
    width: fit-content;
}

.Hovered {
    display: none;
}

body:has(.circle-link[data-item="Cross-Chain"]:hover) .circle-link[data-item="Cross-Chain"],
body:has(.circle-link[data-item="Evolved Rollups"]:hover) .circle-link[data-item="Evolved Rollups"],
body:has(.circle-link[data-item="Future-Forward"]:hover) .circle-link[data-item="Future-Forward"] {
    .Hovered {
        display: block;
    }
    .NotHovered {
        display: none;
    }
}
img:hover {
        transform: scale(1.1) rotate(360deg);
        transition: transform 0.3s;
}
</style>
