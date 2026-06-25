<script lang="ts" setup>
import type { SelectedBridgeFeeDisclosure } from "~/utils/bridgeFees"

const props = defineProps<{
	fees: SelectedBridgeFeeDisclosure
}>()

const feeDetailsTitle = computed(
	() =>
		`Bridge transactions: ${props.fees.static.totalMina} MINA bridge fees. ` +
		`First transfer maximum: ${props.fees.firstTransfer.maximumTotalMina} MINA total: ` +
		`${props.fees.static.totalMina} MINA bridge fees + ` +
		`${props.fees.firstTransfer.helperAccountCreationMina} MINA helper account creation on ` +
		`${props.fees.firstTransfer.destinationAccountLabel} + ` +
		`${props.fees.firstTransfer.recipientAccountCreationMina} MINA recipient account creation on ` +
		`${props.fees.firstTransfer.destinationAccountLabel} when those destination accounts do not exist.`
)
</script>

<template>
  <span class="BridgeFeeNotice">
    <strong>{{ fees.bridgeMinimumLabel }}</strong>
    <button
      class="FeeHelp"
      type="button"
      :aria-label="`Fee details for ${fees.routeLabel}`"
      :title="feeDetailsTitle">
      ?
    </button>
  </span>
</template>

<style lang="postcss" scoped>
.BridgeFeeNotice {
  display: inline-flex;
  gap: 0.35rem;
  align-items: baseline;
  flex-wrap: wrap;

  .FeeHelp {
    display: inline-grid;
    place-items: center;
    width: 1rem;
    height: 1rem;
    padding: 0;
    color: var(--theme-light-text-secondary);
    background: transparent;
    border: 1px solid currentColor;
    border-radius: 50%;
    font-size: 0.7rem;
    line-height: 1;
    cursor: help;
  }
}
</style>
