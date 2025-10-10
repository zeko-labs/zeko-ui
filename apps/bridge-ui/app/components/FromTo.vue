<script lang="ts" setup>
import type { Networks } from "@lumina-dex/sdk"
const { source, destination } = defineProps<{
	source: Networks
	destination: Networks
}>()

const bs = useBridgeStore()
</script>
<template>
  <div class="FromTo">
    <div class="InputBox">
      <h4>From</h4>
      <NetworkSelector target="source" :current-value="[source]" />
    </div>
    <!-- Divider -->
    <div class="divider">
      <input
        type="checkbox"
        id="toggle"
        class="toggle-checkbox"
        @change='bs.bridge.send({ type: "InvertDirection" })'>
      <label for="toggle" class="circle-button">
        <div class="icon-container">
          <!-- Lucide ArrowUpDown Icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="arrow-icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round">
            <path d="m21 16-4 4-4-4" />
            <path d="M17 20V4" />
            <path d="m3 8 4-4 4 4" />
            <path d="M7 4v16" />
          </svg>
        </div>
      </label>
    </div>
    <div class="InputBox">
      <h4>To</h4>
      <NetworkSelector target="destination" :current-value="[destination]" />
    </div>
  </div>
</template>
<style lang="postcss" scoped>
/* Main divider component */
.divider {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 40px 0;
  z-index: 0;
}

/* The horizontal line */
.divider::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: #d1d5db;
  z-index: 0;
}

/* Hidden checkbox for state management */
.toggle-checkbox {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

/* The circular button */
.circle-button {
  position: relative;
  z-index: 1;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: white;
  border: 1px solid #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

/* Button hover state */
.circle-button:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  transform: scale(1.05);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
  .arrow-icon {
    color: #6366f1;
  }
}

/* Button active state */
.circle-button:active {
  transform: scale(0.95);
}

/* Icon container for rotation */
.icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* SVG icon styling */
.arrow-icon {
  width: 20px;
  height: 20px;
  color: #6b7280;
  transition: color 0.3s ease;
}

/* Rotation when checkbox is checked */
.toggle-checkbox:checked ~ .circle-button .icon-container {
  transform: rotate(180deg);
}

/* Additional visual feedback */
@media (prefers-reduced-motion: no-preference) {
  .circle-button {
    animation: pulse 2s infinite;
    animation-play-state: paused;
  }

  .circle-button:focus-visible {
    animation-play-state: running;
  }
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.2);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(99, 102, 241, 0);
  }
}
</style>
