<script lang="ts" setup>
import { bridgeMessages } from "~/helpers"
import type { BridgeOperationContext } from "~~/machines/bridgeOperation"

type Transactions = BridgeOperationContext["transactions"]
type MessageKey = keyof typeof bridgeMessages

const props = defineProps<{
	transactions?: Transactions
	messageKey: MessageKey
	transactionKey?: keyof Transactions
}>()

const message = computed(() => bridgeMessages[props.messageKey])
const url = computed(() =>
	props.transactions && props.transactionKey
		? props.transactions[props.transactionKey]?.result?.url
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
