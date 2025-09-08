<script lang="ts" setup>
const { title, body, link } = defineProps<{
	title: string
	body: string
	link: string
}>()
</script>
<template>
  <div class="Wrapper" :key="title">
    <h2 class="Title">{{ title }}</h2>
    <p class="Text">
      {{ body }}
    </p>
    <div class="CircleLink" :data-item="title">
      <a
        :ref="title"
        :href="link"
        target="_blank">
        <img
          class="Hovered"
          src="~/assets/images/features2/link2.svg"
          alt="Cross-Chain link">

        <img
          class="NotHovered"
          src="~/assets/images/features2/link1.svg"
          alt="Cross-Chain link">
      </a>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
h2, p {
  margin: 0;
}
@media (max-width: 1024px) {
  p {
    max-width: 80vw;
  }
}

.Wrapper {
  display: grid;
  gap: 1rem;
}

.Title {
  font-size: var(--typography-lexend-xxl);
  font-weight: 500;
}

.Text {
  font-weight: 400;
  text-wrap: balance;
}

.CircleLink {
  padding-top: 1rem;
  width: fit-content;
}

.Hovered {
  display: none;
}

body:has(.CircleLink[data-item="Cross-Chain"]:hover)
  .CircleLink[data-item="Cross-Chain"],
body:has(.CircleLink[data-item="Evolved Rollups"]:hover)
  .CircleLink[data-item="Evolved Rollups"],
body:has(.CircleLink[data-item="Future-Forward"]:hover)
  .CircleLink[data-item="Future-Forward"] {
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
