<script lang="ts" setup>
import { CircleHelp } from "lucide-vue-next"
import type { SelectedBridgeFeeDisclosure } from "./bridgeFees"

const props = defineProps<{
	fees: SelectedBridgeFeeDisclosure
}>()

const bridgeTransactionsTooltip =
	"0.1 MINA Send fee + 0.1 MINA Claim fee = 0.2 MINA bridge fees."

const firstTransferTooltip = computed(
	() =>
		`${props.fees.static.totalMina} MINA bridge fees + ` +
		`${props.fees.firstTransfer.helperAccountCreationMina} MINA helper account creation + ` +
		`${props.fees.firstTransfer.recipientAccountCreationMina} MINA recipient account creation on ` +
		`${props.fees.firstTransfer.destinationAccountLabel} when those destination accounts do not exist.`
)
</script>

<template>
  <section class="BridgeFeeNotice" aria-label="Bridge fees">
    <h5>Fees for {{ fees.routeLabel }}</h5>
    <dl>
      <div>
        <dt>Bridge transactions</dt>
        <dd class="FeeValue">
          <span>{{ fees.static.totalMina }} MINA total</span>
          <button
            class="FeeTooltip"
            type="button"
            aria-label="Bridge transaction fee details"
            :data-tooltip="bridgeTransactionsTooltip"
            :title="bridgeTransactionsTooltip">
            <CircleHelp aria-hidden="true" />
          </button>
        </dd>
      </div>
      <div>
        <dt>First transfer maximum</dt>
        <dd class="FeeValue">
          <span>{{ fees.firstTransfer.maximumTotalMina }} MINA total</span>
          <button
            class="FeeTooltip"
            type="button"
            aria-label="First transfer maximum fee details"
            :data-tooltip="firstTransferTooltip"
            :title="firstTransferTooltip">
            <CircleHelp aria-hidden="true" />
          </button>
        </dd>
      </div>
    </dl>
  </section>
</template>

<style lang="postcss" scoped>
.BridgeFeeNotice {
  display: grid;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--palette-gray-300);
  color: var(--theme-light-text-primary);

  h5 {
    margin: 0;
    font-size: var(--typography_fluid-lexend-s);
    font-weight: var(--typography-weight-lexend-semibold);
  }

  dl {
    display: grid;
    gap: 0.65rem;
    margin: 0;
  }

  div {
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) minmax(0, 1.4fr);
    gap: 1rem;
    align-items: baseline;
  }

  dt,
  dd {
    margin: 0;
  }

  dt {
    color: var(--theme-light-text-secondary);
  }

  dd {
    margin: 0;
    font-weight: var(--typography-weight-lexend-semibold);
  }

  .FeeValue {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
  }

  .FeeTooltip {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.1rem;
    height: 1.1rem;
    padding: 0;
    color: var(--theme-light-text-secondary);
    background: transparent;
    border: 0;
    cursor: help;

    svg {
      width: 1rem;
      height: 1rem;
      stroke-width: 1.8;
    }

    &::after {
      content: attr(data-tooltip);
      position: absolute;
      right: 0;
      bottom: calc(100% + 0.45rem);
      z-index: 10;
      width: min(20rem, calc(100vw - 2rem));
      padding: 0.55rem 0.65rem;
      color: oklch(0.98 0.01 94);
      background: oklch(0.19 0.02 245 / 0.96);
      border: 1px solid oklch(0.9 0.01 94 / 0.16);
      border-radius: 0.4rem;
      box-shadow: 0 0.75rem 2rem oklch(0 0 0 / 0.22);
      font-size: 0.75rem;
      font-style: italic;
      font-weight: var(--typography-weight-lexend-regular);
      line-height: 1.45;
      text-align: left;
      white-space: normal;
      opacity: 0;
      pointer-events: none;
      transform: translateY(0.15rem);
      transition: opacity 120ms ease, transform 120ms ease;
    }

    &:hover::after,
    &:focus-visible::after {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 720px) {
    div {
      grid-template-columns: 1fr;
      gap: 0.25rem;
    }
  }
}
</style>
