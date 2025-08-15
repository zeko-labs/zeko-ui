<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { Field } from "@ark-ui/vue/field"
// biome-ignore lint/correctness/noUnusedImports: <explanation>
// biome-ignore lint/style/useImportType: <explanation>
import { Select, createListCollection, useSelect } from "@ark-ui/vue/select"
import type { Networks } from "@lumina-dex/sdk"
import { theme } from "@zeko/design"
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { ChevronDownIcon } from "lucide-vue-next"
import { SvgMinaToken, SvgZekoToken } from "#components"

const emit = defineEmits(["select:network"])

const {
	currentValue,
	target,
	enabled = "testnet"
} = defineProps<{
	currentValue: [Networks]
	target: "source" | "destination"
	enabled?: "testnet" | "mainnet" | "all"
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

const isMina = computed(() => currentValue[0].includes("mina"))

const currentLogo = computed(() => (isMina.value ? SvgMinaToken : SvgZekoToken))

const name = (network: Networks | undefined) => {
	if (!network) return undefined
	return {
		"mina:devnet": "Mina (Devnet)",
		"zeko:testnet": "Zeko (Testnet)",
		"mina:mainnet": "Mina",
		"zeko:mainnet": "Zeko"
	}[network]
}

const colors = theme.config.colors

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
          <div class="TriggerWrapper">
            <Select.Trigger>
              <div class="TriggerContent">
                <div class="TextWithLogo">
                  <component :is="currentLogo" />
                  <Select.ValueText placeholder="Placeholder" as-child>
                    {{ name(select.value[0] as Networks) }}
                  </Select.ValueText>
                </div>
                <Select.Indicator>
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
                <Select.ItemGroupLabel>Frameworks</Select.ItemGroupLabel>
                <Select.Item v-for="item of collection.items" :key="item" :item>
                  <component
                    :is='item.includes("mina") ? SvgMinaToken : SvgZekoToken'
                  />
                  <Select.ItemText>{{ name(item) }}</Select.ItemText>
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
  background-color: v-bind("colors.spaceBlue.value");
  border-radius: 8px;
  border: 1px solid v-bind("colors.gray[200].value");
  overflow: hidden;
}

.TriggerWrapper {
  padding: 10px 8px;
}

.TriggerContent {
  display: flex;
  align-items: center;
  justify-content: space-between;
  .TextWithLogo {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-gap: 1ch;
    align-items: center;
  }
}

/* Select button */
[data-scope="select"][data-part="trigger"] {
  display: grid;
  align-items: center;
  background-color: v-bind("colors.spaceBlue.value");
  color: v-bind("colors.gray[900].value");
  cursor: pointer;
  border: 0;
  border-radius: 4px;
  height: 36px;
  width: 100%;
  font-size: 16px;
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 1px v-bind("colors.gray[200].value");
  }
}

/* Hide the native select element */
select[aria-hidden="true"] {
  display: none;
}

/* Select dropdown menu*/
[data-scope="select"][data-part="content"] {
  color: v-bind("colors.gray[900].value");
  background-color: v-bind("colors.gray[100].value");
  border: 1px solid white;
  border-radius: 4px;
  padding: 10px 8px;
  margin-top: 4px;
  width: var(--reference-width);
  transform: scale(1.02);
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 1px v-bind("colors.gray[200].value");
  }
}

[data-scope="select"][data-part="item-group"] {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

[data-scope="select"][data-part="item-group-label"] {
  display: none;
}

[data-scope="select"][data-part="item"] {
  padding: 0px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 1ch;
  [data-part="item-indicator"] {
    margin-left: auto;
  }

  &[data-highlighted] {
    box-shadow: 0 0 0 1px v-bind("colors.gray[200].value");
  }

  &:hover, [data-highlighted] {
    color: white;
  }

  &[aria-selected="true"] {
    &:hover, [data-highlighted] {
      color: v-bind("colors.gray[900].value");
    }
    background-color: rgba(250, 250, 250, 0.8);
  }
}
</style>
