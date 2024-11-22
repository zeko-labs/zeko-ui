<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { Field } from "@ark-ui/vue/field"
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { Select, createListCollection } from "@ark-ui/vue/select"
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { ChevronDownIcon } from "lucide-vue-next"
import { theme } from "~~/helpers/theme"
import { SvgMinaToken, SvgZekoToken } from "#components"

type Blockchains = "MINA L1" | "ZEKO L2"

const emit = defineEmits(["invertChains"])

const { currentValue } = defineProps<{ currentValue: Blockchains }>()
const collection = createListCollection({
	items: ["MINA L1", "ZEKO L2"]
})

const currentLogo = computed(() => {
	return { "MINA L1": SvgMinaToken, "ZEKO L2": SvgZekoToken }[currentValue]
})

const value = computed(() => [currentValue])

const colors = theme.config.colors

const swap = () => {
	emit("invertChains")
}
</script>

<template>
  <Field.Root>
    <Select.Root :collection :default-value="value" v-model="value">
      <Select.Control asChild>
        <div class="TriggerWrapper">
          <Select.Trigger @click="swap">
            <div class="TriggerContent">
              <div class="TextWithLogo">
                <component :is="currentLogo" />
                <Select.ValueText placeholder="Placeholder" />
              </div>
              <Select.Indicator>
                <ChevronDownIcon :stroke-width="1" />
              </Select.Indicator>
            </div>
          </Select.Trigger>
        </div>
      </Select.Control>
      <Select.HiddenSelect />
    </Select.Root>
  </Field.Root>
</template>

<style lang="postcss" scoped>
span {
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
  width: 500px;
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
    grid-gap: 4px;
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
</style>
