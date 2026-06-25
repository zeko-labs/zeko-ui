<script lang="ts" setup>
import type { BridgeFeeDisclosure } from "./bridgeFees"

defineProps<{
	fees: BridgeFeeDisclosure
}>()
</script>

<template>
  <section class="BridgeFeeNotice" aria-label="Bridge fees">
    <h5>Fees</h5>
    <dl>
      <div>
        <dt>Bridge transactions</dt>
        <dd>
          {{ fees.static.totalMina }} MINA total
          <span>
            {{ fees.static.requestMina }} send + {{ fees.static.claimMina }}
            claim
          </span>
        </dd>
      </div>
      <div>
        <dt>Deposit total</dt>
        <dd>
          Up to {{ fees.deposit.maximumFirstOperationFeeMina }} MINA total
          <span>
            May include {{ fees.deposit.helperAccountCreationMina }} helper +
            {{ fees.deposit.recipientAccountCreationMina }} recipient on Zeko
          </span>
        </dd>
      </div>
      <div>
        <dt>Withdrawal total</dt>
        <dd>
          Up to {{ fees.withdrawal.maximumFirstOperationFeeMina }} MINA total
          <span>
            May include {{ fees.withdrawal.helperAccountCreationMina }} helper +
            {{ fees.withdrawal.recipientAccountCreationMina }} recipient on Mina
          </span>
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
    display: grid;
    gap: 0.2rem;
    font-weight: var(--typography-weight-lexend-semibold);
  }

  span {
    color: var(--theme-light-text-secondary);
    font-size: var(--typography_fluid-lexend-xs);
    font-weight: var(--typography-weight-lexend-regular);
  }

  @media (max-width: 720px) {
    div {
      grid-template-columns: 1fr;
      gap: 0.25rem;
    }
  }
}
</style>
