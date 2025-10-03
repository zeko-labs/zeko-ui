<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { Field } from "@ark-ui/vue/field"
// biome-ignore lint/correctness/noUnusedImports: <explanation>
// biome-ignore lint/style/useImportType: <explanation>
import { Select, createListCollection, useSelect } from "@ark-ui/vue/select"
import type { Networks } from "@lumina-dex/sdk"
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { ChevronDownIcon } from "lucide-vue-next"

const emit = defineEmits(["select:network"])

const {
	currentValue,
	target,
	enabled = "testnet",
	loading = false
} = defineProps<{
	currentValue: [Networks]
	target: "source" | "destination"
	enabled?: "testnet" | "mainnet" | "all"
	loading?: boolean
}>()

const bs = useBridgeStore()

const collection = createListCollection({
	items: (
		[
			"mina:devnet",
			"zeko:testnet",
			"mina:mainnet",
			"zeko:mainnet"
		] as Networks[]
	).filter((item) => {
		if (enabled === "testnet") return !item.includes("mainnet")
		if (enabled === "mainnet") return item.includes("mainnet")
		return true
	})
})

const onValueChange = (details: Select.ValueChangeDetails) => {
	if (target === "source") {
		const sourceNetwork = details.value[0] as Networks
		bs.bridge.send({ type: "SetSource", sourceNetwork })
	}
	if (target === "destination") {
		const destinationNetwork = details.value[0] as Networks
		bs.bridge.send({ type: "SetDestination", destinationNetwork })
	}
}

const select = useSelect({
	collection,
	defaultValue: currentValue,
	multiple: false,
	disabled: true,
	onValueChange
})

watch(
	() => currentValue,
	(newValue) => {
		select.value.setValue(newValue)
	}
)
</script>

<template>
  <div class="NetworkSelector">
    <!-- <div class="debug">
      {{ { currentValue, target, isMina, currentLogo: currentLogo.__name } }}
    </div> -->
    <Field.Root>
      <Select.RootProvider :value="select">
        <Select.Control asChild>
          <div :class="{ TriggerWrapper: true, isLoading: loading }">
            <LoadingInput v-if="loading" />
            <Select.Trigger>
              <div class="TriggerContent" v-show="!loading">
                <Select.ValueText placeholder="Placeholder" as-child>
                  <NetworkBadge
                    :icon="true"
                    :network="select.value[0] as Networks"
                  />
                </Select.ValueText>
                <Select.Indicator style="display: none">
                  <ChevronDownIcon :stroke-width="1" />
                </Select.Indicator>
              </div>
            </Select.Trigger>
          </div>
        </Select.Control>
        <Teleport to="body">
          <Select.Positioner>
            <Select.Content>
              <Select.ItemGroup>
                <Select.ItemGroupLabel>Networks</Select.ItemGroupLabel>
                <Select.Item v-for="item of collection.items" :key="item" :item>
                  <Select.ItemText>
                    <NetworkBadge :icon="true" :network="item" />
                  </Select.ItemText>
                  <Select.ItemIndicator>✓</Select.ItemIndicator>
                </Select.Item>
              </Select.ItemGroup>
            </Select.Content>
          </Select.Positioner>
        </Teleport>
        <Select.HiddenSelect />
      </Select.RootProvider>
    </Field.Root>
  </div>
</template>

<style lang="postcss" scoped>
span, button {
  font-family: Lexend;
  font-weight: 400;
}

/* Select container */
[data-scope="field"][data-part="root"] {
  display: grid;
  grid-template-columns: 1fr;
  background-color: var(--palette-basic-spaceBlue);
  border-radius: 8px;
  border: 1px solid var(--palette-gray-200);
  overflow: hidden;
}

.TriggerWrapper {
  padding: 10px 8px;
  position: relative;
  &.isLoading {
    padding: 10px 0;
    cursor: not-allowed;
  }
}

.TriggerContent {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Select button */
[data-scope="select"][data-part="trigger"] {
  display: grid;
  align-items: center;
  background-color: var(--palette-basic-spaceBlue);
  color: var(--palette-gray-900);
  cursor: pointer;
  border: 0;
  border-radius: 4px;
  height: 36px;
  width: 100%;
  font-size: 16px;
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 1px var(--palette-gray-200);
  }

  .isLoading & {
    cursor: not-allowed;
  }
}

/* Hide the native select element */
select[aria-hidden="true"] {
  display: none;
}

/* Select dropdown menu*/
[data-scope="select"][data-part="content"] {
  color: var(--palette-gray-900);
  background-color: var(--palette-gray-200);
  border: 1px solid white;
  border-radius: 4px;
  padding: 10px 8px;
  margin-top: 4px;
  width: var(--reference-width);
  transform: scale(1.02);
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 1px var(--palette-gray-200);
  }
}

[data-scope="select"][data-part="item-group"] {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

[data-scope="select"][data-part="item-group-label"] {
  display: none;
}

[data-scope="select"][data-part="item"] {
  padding: 8px 8px;
  border-radius: 4px;
  border: none;
  display: flex;
  align-items: center;
  gap: 1ch;
  [data-part="item-indicator"] {
    margin-left: auto;
  }

  &[data-highlighted] {
    box-shadow: 0 0 0 1px var(--palette-basic-white);
  }

  &:hover, [data-highlighted] {
    color: var(--palette-basic-white);
  }

  &[aria-selected="true"] {
    &:hover, [data-highlighted] {
      color: var(--palette-gray-950);
    }
    background-color: var(--palette-basic-white);
  }
}
</style>
