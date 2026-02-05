<script lang="ts" setup>
import { bridgeMessages } from "~/helpers"
import type { BridgeOperationContext } from "~~/machines/bridgeOperation"

type Transactions = BridgeOperationContext["transactions"]
type MessageKey = keyof typeof bridgeMessages

const { transactions, messageKey, transactionKey } = defineProps<{
	transactions?: Transactions
	messageKey: MessageKey
	transactionKey?: keyof Transactions
}>()

const message = computed(() => bridgeMessages[messageKey])
const url = computed(() =>
	transactions && transactionKey
		? transactions[transactionKey]?.result?.url
		: undefined
)
const scan = computed(() =>
	url.value?.includes("zeko") ? "ZekoScan" : "MinaScan"
)
</script>
<template>
  <span>
    <span v-html="message" />
    <span v-if="url">
      View transaction status on
      <a :href="url" target="_blank" rel="noopener noreferrer">{{
        scan
      }}</a>.</span>
  </span>
</template>
