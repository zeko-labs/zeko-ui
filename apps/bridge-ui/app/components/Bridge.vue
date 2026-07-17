<script lang="ts" setup>
import { Settings } from "lucide-vue-next"
import type { ActorRefFromLogic } from "xstate"
import { deriveBridgeQueues, type BridgeQueueItem } from "~/helpers"
import { completedOperationReconciliationHash } from "~/utils/pendingReconciliation"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"
import { isMinaBridgeNetwork, isZekoBridgeNetwork } from "~~/machines/networks"
import {
	loadPendingBridgeTransactions,
	PENDING_BRIDGE_TRANSACTIONS_CHANGED_EVENT,
	reconcilePendingBridgeTransactions
} from "~~/machines/pendingTransactions"
import { useSelector } from "~~/machines/vue-xstate"

const bs = useBridgeStore()
const isSettingsOpen = ref(false)

type OperationCard = BridgeQueueItem<
	ActorRefFromLogic<typeof bridgeOperationMachine>
>

const allOperations = useSelector(bs.bridge.actorRef, (state) => {
	const items: OperationCard[] = [...state.context.operations.values()].map(
		({ operation, order, status, lane }) => ({
			id: operation.id,
			order,
			status,
			lane,
			direction: operation.getSnapshot().context.direction,
			operation
		})
	)

	return {
		...deriveBridgeQueues(items),
		activeCancellationOperation: state.context.activeCancellationOperation,
		currentSlot: state.context.currentSlot,
		sourceNetwork: state.context.sourceNetwork,
		destinationNetwork: state.context.destinationNetwork
	}
})

const operationTransactionHash = (
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
) => {
	const context = operation.getSnapshot().context
	return (
		context.transaction?.hash ??
		context.transactions.submitDeposit?.result?.hash ??
		context.transactions.submitWithdrawal?.result?.hash ??
		null
	)
}

const completedOperations = computed(() => allOperations.value.completed ?? [])

const currentOperation = computed(
	() => allOperations.value.currentMainOperation
)

const depositQueue = computed(() => allOperations.value.depositQueue ?? [])

const withdrawalQueue = computed(
	() => allOperations.value.withdrawalQueue ?? []
)

const cancellableOperations = computed(
	() => allOperations.value.cancellableOperations ?? []
)

const activeCancellationOperation = computed(
	() => allOperations.value.activeCancellationOperation
)

const currentSlot = computed(() => allOperations.value.currentSlot)

const bridgeNetworkScope = computed(() => {
	const { sourceNetwork, destinationNetwork } = allOperations.value
	if (
		isMinaBridgeNetwork(sourceNetwork) &&
		isZekoBridgeNetwork(destinationNetwork)
	) {
		return { l1: sourceNetwork, l2: destinationNetwork }
	}
	if (
		isMinaBridgeNetwork(destinationNetwork) &&
		isZekoBridgeNetwork(sourceNetwork)
	) {
		return { l1: destinationNetwork, l2: sourceNetwork }
	}
	return null
})

const pendingOperationsVersion = ref(0)
const operationStatusVersion = ref(0)

const refreshPendingOperations = () => {
	pendingOperationsVersion.value += 1
}

const statusTrackedOperations = computed(() => [
	...(currentOperation.value ? [currentOperation.value] : []),
	...depositQueue.value,
	...withdrawalQueue.value,
	...cancellableOperations.value,
	...completedOperations.value.map(({ operation }) => operation)
])

watch(
	statusTrackedOperations,
	(operations, _previousOperations, onCleanup) => {
		operationStatusVersion.value += 1
		const subscriptions = operations.map((operation) =>
			operation.subscribe(() => {
				operationStatusVersion.value += 1
			})
		)
		onCleanup(() => {
			for (const subscription of subscriptions) subscription.unsubscribe()
		})
	},
	{ immediate: true }
)

const localPendingStatusByHash = computed(() => {
	void operationStatusVersion.value
	return new Map(
		statusTrackedOperations.value.flatMap((operation) => {
			const snapshot = operation.getSnapshot()
			const hash = operationTransactionHash(operation)
			if (snapshot.context.actionIndex === undefined || !hash) return []
			const status =
				snapshot.matches("BRIDGE_OPERATION_COMPLETED") ||
				snapshot.matches({ FINALIZE_DEPOSIT: "transaction" }) ||
				snapshot.matches({ FINALIZE_DEPOSIT: "done" }) ||
				snapshot.matches({ FINALIZE_WITHDRAWAL: "transaction" }) ||
				snapshot.matches({ FINALIZE_WITHDRAWAL: "done" })
					? "finalizing"
					: "awaiting-claim"
			return [[hash, status] as const]
		})
	)
})

const pendingOperations = computed(() => {
	void pendingOperationsVersion.value
	if (!bs.address || !bridgeNetworkScope.value) return []
	return loadPendingBridgeTransactions({
		walletAddress: bs.address,
		...bridgeNetworkScope.value
	}).map((transaction) => {
		const status = localPendingStatusByHash.value.get(
			transaction.transactionHash
		)
		return status ? { ...transaction, status } : transaction
	})
})

onMounted(() => {
	window.addEventListener(
		PENDING_BRIDGE_TRANSACTIONS_CHANGED_EVENT,
		refreshPendingOperations
	)
})

onBeforeUnmount(() => {
	window.removeEventListener(
		PENDING_BRIDGE_TRANSACTIONS_CHANGED_EVENT,
		refreshPendingOperations
	)
})

const completedIndexedTransactionHashesKey = computed(() =>
	completedOperations.value
		.flatMap(({ operation }) => {
			const context = operation.getSnapshot().context
			if (context.actionIndex === undefined) return []
			const hash = completedOperationReconciliationHash({
				hash: operationTransactionHash(operation),
				completionVerification: context.completionVerification
			})
			return hash ? [hash] : []
		})
		.join(",")
)

watch(
	[completedIndexedTransactionHashesKey, bridgeNetworkScope, () => bs.address],
	([hashesKey, scope, walletAddress]) => {
		if (!walletAddress || !scope || !hashesKey) return
		reconcilePendingBridgeTransactions({
			walletAddress,
			...scope,
			transactionHashes: hashesKey.split(",")
		})
	},
	{ immediate: true }
)
</script>
<template>
  <div class="Bridge">
    <div class="MainOperation">
      <button
        type="button"
        class="SettingsButton"
        title="Bridge Settings"
        @click="(isSettingsOpen = true)">
        <Settings />
      </button>
      <BridgeSettings
        :isOpen="isSettingsOpen"
        @close="(isSettingsOpen = false)"
      />
      <Inputs v-if="!currentOperation" />
      <CurrentOperation
        v-else
        :key="currentOperation.id"
        :operation="currentOperation"
      />
    </div>
    <div
      v-if="cancellableOperations.length > 0"
      class="CancellableTransactions">
      <h3>Cancellable Deposits</h3>
      <div class="QueuedOperations">
        <CancellableOperation
          v-for="(operation, index) in cancellableOperations"
          :key="operation.id"
          :operation
          :index
          :currentSlot
          :disabled="
            activeCancellationOperation !== null &&
            activeCancellationOperation !== operation.id
          "
        />
      </div>
      <h4>
        These deposits can be cancelled separately without blocking new bridge
        requests.
      </h4>
    </div>
    <div
      v-if="depositQueue.length > 0"
      class="NextTransactions">
      <h3>Deposit Queue</h3>
      <div class="QueuedOperations">
        <QueuedOperation
          v-for="(operation, index) in depositQueue"
          :key="operation.id"
          :operation
          :index
          :currentSlot
        />
      </div>
      <h4>
        Deposits are processed in submission order and always run before queued
        withdrawals.
      </h4>
    </div>
    <div
      v-if="withdrawalQueue.length > 0"
      class="NextTransactions">
      <h3>Withdrawal Queue</h3>
      <div class="QueuedOperations">
        <QueuedOperation
          v-for="(operation, index) in withdrawalQueue"
          :key="operation.id"
          :operation
          :index
          :currentSlot
        />
      </div>
      <h4>
        Withdrawals run after all non-cancellable deposits ahead of them have
        been processed.
      </h4>
    </div>
    <div class="CompletedTransactions">
      <h3>Transactions</h3>
      <BridgeOperations
        :operations="completedOperations"
        :pendingOperations
      />
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.MainOperation {
  display: grid;
  grid-template-columns: auto;
  margin: auto;
  max-width: 50rem;
  position: relative;
  @media (max-width: 1024px) {
    grid-template-columns: auto;
    gap: 2rem;
  }

  .SettingsButton {
    position: absolute;
    top: -2.5rem;
    right: 0rem;
    z-index: 10;
    display: grid;
    place-items: center;
    padding: 0.5rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    color: var(--palette-gray-600);
    transition: all 0.2s;

    &:hover {
      background: var(--palette-gray-200);
      color: var(--palette-gray-800);
    }
  }
}

.CancellableTransactions,
.NextTransactions {
  margin-top: 2rem;
  h4 {
    font-style: italic;
  }
  .QueuedOperations {
    display: flex;
    gap: 3ch;
    max-width: calc(100vw - 2 * var(--page-padding, 0));
    overflow-y: scroll;
    padding: 1rem 0;
  }
}

.CompletedTransactions {
  display: grid;
  &:has(.Spinner) {
    place-items: center;
  }
  .Spinner {
    --size: 25rem;
    height: auto;
    width: var(--size);
  }
}
</style>
