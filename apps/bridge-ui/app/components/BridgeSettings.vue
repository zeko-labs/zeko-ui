<script lang="ts" setup>
import { XIcon } from "lucide-vue-next"
import type { BridgeTimeoutHours } from "../composables/useBridgeSettings"

const { isOpen } = defineProps<{ isOpen: boolean }>()

const emit = defineEmits<{ close: [] }>()

const bridgeSettings = useBridgeSettings()
const timeoutOptions: BridgeTimeoutHours[] = [6, 12, 24, 36]

const selectTimeout = (hours: BridgeTimeoutHours) => {
	bridgeSettings.setTimeoutHours(hours)
}
</script>
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="BridgeSettingsOverlay"
        @click.self='emit("close")'>
        <div class="BridgeSettingsPopup">
          <div class="Header">
            <h3>Bridge Timeout</h3>
            <button type="button" class="CloseButton" @click='emit("close")'>
              <XIcon :size="20" />
            </button>
          </div>
          <p class="Description">
            You can cancel your transaction after the Bridge Timeout.
          </p>
          <div class="TimeoutOptions">
            <DevOnly>
              <label class="TimeoutOption">
                <input
                  type="radio"
                  name="timeout"
                  value="dev"
                  :checked="bridgeSettings.timeoutHours.value === 0"
                  @change="selectTimeout(0)">
                <span>180s (dev)</span>
              </label>
            </DevOnly>
            <label
              v-for="hours of timeoutOptions"
              :key="hours"
              class="TimeoutOption">
              <input
                type="radio"
                name="timeout"
                :value="hours"
                :checked="bridgeSettings.timeoutHours.value === hours"
                @change="selectTimeout(hours)">
              <span>{{ hours }} hours</span>
            </label>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
<style lang="postcss" scoped>
.BridgeSettingsOverlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: oklch(0 0 0 / 0.3);
}

.BridgeSettingsPopup {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 20rem;
  padding: 1.5rem;
  background: var(--palette-gray-50);
  border-radius: 1rem;
  box-shadow: 0 4px 24px oklch(0 0 0 / 0.15);

  .Header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      margin: 0;
      font-size: var(--typography_fluid-lexend-m);
      font-weight: var(--typography-weight-lexend-semibold);
    }

    .CloseButton {
      display: grid;
      place-items: center;
      padding: 0.25rem;
      background: transparent;
      border: none;
      border-radius: 0.25rem;
      cursor: pointer;
      color: var(--palette-gray-600);

      &:hover {
        background: var(--palette-gray-200);
      }
    }
  }

  .Description {
    margin: 0;
    font-size: var(--typography_fluid-lexend-s);
    color: var(--palette-gray-600);
  }

  .TimeoutOptions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;

    .TimeoutOption {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      font-size: var(--typography_fluid-lexend-s);

      input[type="radio"] {
        appearance: none;
        width: 1rem;
        height: 1rem;
        border: 2px solid var(--palette-gray-400);
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s;

        &:checked {
          border-color: var(--palette-cosmicGold-100);
          background: var(--palette-cosmicGold-100);
          box-shadow: inset 0 0 0 3px var(--palette-gray-50);
        }
      }
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
