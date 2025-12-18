<script lang="ts" setup>
import { bridgeMessages } from "~/helpers"
import type { BridgeOperationContext } from "~~/machines/bridgeOperation"

type Transactions = BridgeOperationContext["transactions"]
const { transactions, transactionKey } = defineProps<{
	transactions: Transactions
	transactionKey: keyof Transactions
}>()

const message = computed(() => bridgeMessages[transactionKey])
const url = computed(() => transactions[transactionKey]?.result?.url)
const scan = computed(() =>
	url.value?.includes("zeko") ? "ZekoScan" : "MinaScan"
)
</script>
<template>
  <span>
    <span>{{ message }}.</span>
    <span v-if="url">
      View transaction status on <a
        :href="url"
        target="_blank"
        rel="noopener noreferrer">{{ scan }}</a>.</span>
  </span>
</template>
