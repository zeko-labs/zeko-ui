<script setup lang="ts">
const lb = useLeaderboard()

const displayCount = computed(() =>
	Number(lb.transactionCount).toLocaleString("en-US")
)
</script>
<template>
  <div class="Header">
    <NightSky />
    <SvgRingsInner class="Inner" />
    <SvgRingsMiddle class="Middle" />
    <SvgRingsOuter class="Outer" />
    <div class="Content">
      <div class="Logo">
        <SvgZekoBoom />
        <div class="Title">Testnet Contest</div>
      </div>
      <div class="TransactionBox">
        <div class="Count">{{ displayCount }}</div>
        <div class="Label">Total Transactions</div>
      </div>
    </div>
  </div>
</template>
<style lang="postcss" scoped>
@keyframes rotate-clockwise {
  from {
    rotate: 0deg;
  }
  to {
    rotate: 360deg;
  }
}

@keyframes rotate-counter-clockwise {
  from {
    rotate: 0deg;
  }
  to {
    rotate: -360deg;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.8;
  }
}

.Header {
  --ring-scale: clamp(0.3, 0.3 + (100vw - 320px) / (3440px - 320px) * 2.2, 2.5);
  grid-area: header;
  position: relative;
  display: grid;
  place-items: center;
  border-radius: 1rem;
  z-index: 0;
  overflow: hidden;
  > svg {
    position: absolute;
    z-index: 1;
    transform: scale(var(--ring-scale));
    &.Inner {
      animation:
        rotate-clockwise 20s linear infinite,
        pulse 3s ease-in-out infinite;
    }
    &.Middle {
      animation:
        rotate-counter-clockwise 30s linear infinite,
        pulse 4s ease-in-out infinite;
      animation-delay: 0s, 1s;
    }
    &.Outer {
      animation:
        rotate-clockwise 40s linear infinite,
        pulse 5s ease-in-out infinite;
      animation-delay: 0s, 2s;
    }
  }
}
.Content {
  display: flex;
  flex-direction: column;
  place-items: center;
  gap: 1.3125rem;
  padding: 4.5rem 1rem;
  z-index: 2;
}

.Logo {
  .Title {
    color: oklch(1 0 0 / 80%);
    text-align: center;
    font-size: var(--typography_fluid-lexend-l);
    font-weight: 500;
    line-height: 155%;
    letter-spacing: -0.01125rem;
    text-transform: uppercase;
  }
}
.TransactionBox {
  background: oklch(0.2484 0 0);
  border: 1px solid oklch(0.3802 0 0);
  border-radius: 1rem;
  font-weight: 400;
  display: flex;
  padding: 0.375rem 1rem;
  flex-direction: column;
  place-items: center;
  width: fit-content;
  .Count {
    font-family: "Russo One", sans-serif;
    font-size: var(--typography_fluid-lexend-h3);
    color: transparent;
    background: var(--gradients-goldGradient-brand-logo);
    background-clip: text;
    line-height: 125%;
  }
  .Label {
    color: oklch(1 0 0 / 75%);
    text-align: center;
    font-size: var(--typography_fluid-lexend-l);
    line-height: 155%;
    letter-spacing: 0.08438rem;
    text-transform: uppercase;
  }
}
</style>
