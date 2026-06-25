<script lang="ts" setup>
import { ArrowRightIcon } from "lucide-vue-next"
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
    <strong class="RouteMinimum">
      <span>{{ fees.sourceShortLabel }}</span>
      <ArrowRightIcon class="RouteArrow" aria-hidden="true" />
      <span>{{ fees.destinationShortLabel }} bridge minimum {{
          fees.minimumAmountMina
        }} MINA</span>
    </strong>
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
  gap: 0.3rem;
  align-items: center;
  flex-wrap: wrap;

  .RouteMinimum {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    min-width: 0;
    line-height: 1.1;
  }

  .RouteArrow {
    flex: 0 0 auto;
    width: 0.85rem;
    height: 0.85rem;
  }

  .FeeHelp {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
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
