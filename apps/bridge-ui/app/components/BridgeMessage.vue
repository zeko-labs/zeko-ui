<script lang="ts" setup>
import { bridgeMessages } from "~/helpers"
import type { BridgeOperationContext } from "~~/machines/bridgeOperation"

type Transactions = BridgeOperationContext["transactions"]
type MessageKey = keyof typeof bridgeMessages

defineProps<{
	transactions?: Transactions
	messageKey: MessageKey
	transactionKey?: keyof Transactions
}>()
</script>
<template>
  <span>
    <span v-html="bridgeMessages[messageKey]" />
  </span>
</template>
