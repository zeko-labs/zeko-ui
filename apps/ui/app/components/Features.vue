<script lang="ts" setup>
import { useIntersectionObserver } from "@vueuse/core"

const targetIsVisible = shallowRef(false)

const classes = computed(() => ({
	Card: true,
	Revealed: targetIsVisible.value
}))

const target = useTemplateRef<HTMLDivElement>("target")
const { stop } = useIntersectionObserver(target, ([entry], observerElement) => {
	targetIsVisible.value = entry?.isIntersecting || false
})
onUnmounted(() => stop())
</script>
<template>
  <div class="Wrapper" ref="target">
    <div :class="classes">
      <img
        class="One"
        src="~/assets/images/features/reveal.webp"
        loading="lazy"
        alt="Text Reveal Effect"
      />
      <p>
        Zero-knowledge is the technology of Trust, embedding security in digital
        interactions and foundational for building our future on blockchain
      </p>
    </div>
    <div :class="classes">
      <img
        class="Two"
        src="~/assets/images/features/reveal.webp"
        loading="lazy"
        alt="Text Reveal Effect"
      />
      <p>
        zkApps like decentralized AI. are natively scalable and modular,
        utilizing off-chain compute, storage, and data to augment UX and reduce
        costs
      </p>
    </div>
    <div :class="classes">
      <img
        class="Three"
        src="~/assets/images/features/reveal.webp"
        loading="lazy"
        alt="Text Reveal Effect"
      />
      <p>
        Zeko zkRollup powers the future of decentralized apps with advanced
        programmability, cryptography, and automated agents
      </p>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.Wrapper {
  grid-template-columns: repeat(3, 1fr);
  display: grid;
  gap: 2.5rem;
  margin: 0 auto;
  height: 100%;
  padding: 4rem;
  .Card {
    display: flex;
    padding: 2.25rem 2rem;
    justify-content: center;
    align-items: center;
    border-radius: 1rem;
    position: relative;
    background: white;
    img {
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      object-fit: cover;
      z-index: 0;
      border-radius: 1rem;
    }
    &.Revealed {
       img.One {
        opacity: 0; 
        transition: opacity 2s ease-out;
      }
      img.Two {
        opacity: 0; 
        transition: opacity 2s ease-out 1s;
      }
      img.Three {
        opacity: 0; 
        transition: opacity 2s ease-out 2s;
      }
    } 
  }
}

@media (max-width: 1024px) {
  .Wrapper  {
    grid-template-rows: repeat(3, 1fr);
    grid-template-columns: 1fr;
    padding: 4rem 1rem;
  }
}
</style>
