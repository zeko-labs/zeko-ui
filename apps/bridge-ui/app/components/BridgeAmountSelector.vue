<script setup lang="ts">
import { Field } from "@ark-ui/vue/field"
import { createListCollection, Select } from "@ark-ui/vue/select"
import { ChevronDownIcon } from "lucide-vue-next"

const { loading = false } = defineProps<{ loading?: boolean }>()
const modelValue = defineModel({ required: true })
const collection = createListCollection({
	items: ["MINA", "ZEKO"] as const
})
</script>

<template>
  <div class="SelectWrapper">
    <Field.Root>
      <LoadingInput v-if="loading" />
      <Field.Input
        type="number"
        step="0.01"
        min="0"
        @wheel.prevent="() => {}"
        v-model="modelValue"
        v-bind="$attrs"
        :disabled="loading"
        :placeholder='loading ? "" : "Enter Amount"'
      />
    </Field.Root>
    <Field.Root>
      <Select.Root :collection :default-value='["MINA"]' :disabled="true">
        <Select.Control asChild>
          <div class="TriggerWrapper">
            <Select.Trigger>
              <div class="TriggerContent">
                <div class="TextWithLogo">
                  <SvgMinaLogo width="24" height="24" />
                  <Select.ValueText placeholder="Placeholder" />
                </div>
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
                <Select.ItemGroupLabel>Tokens</Select.ItemGroupLabel>
                <Select.Item v-for="item of collection.items" :key="item" :item>
                  <!-- <Select.ItemContext>OK</Select.ItemContext> -->
                  <Select.ItemText>{{ item }}</Select.ItemText>
                  <!-- <Select.ItemIndicator>✓</Select.ItemIndicator> -->
                </Select.Item>
              </Select.ItemGroup>
            </Select.Content>
          </Select.Positioner>
        </Teleport>
        <Select.HiddenSelect />
      </Select.Root>
    </Field.Root>
  </div>
</template>

<style lang="postcss" scoped>
/* Main container */
.SelectWrapper {
  position: relative;
  display: grid;
  cursor: default;
  justify-content: space-between;
  grid-template-columns: 1fr auto;
  background-color: var(--palette-basic-spaceBlue);
  border-radius: 8px;
  border: 1px solid var(--palette-gray-200);
  overflow: hidden;
}

span,
input {
  font-family: Lexend;
  font-weight: 400;
}

/* Input field */
[data-scope="field"][data-part="input"] {
  background: transparent;
  border: none;
  color: var(--palette-gray-900);
  font-size: var(--typography_fluid-lexend-s);
  padding: 12px 0px 12px 16px;
  outline: none;
  height: 100%;
  width: 100%;
}

/* Select container */
[data-scope="select"][data-part="root"] {
  min-width: 100%;
}

.TriggerWrapper {
  padding: 10px 8px;
  background-color: var(--palette-basic-spaceBlue);
}

.TriggerContent {
  display: inline-flex;
  .TextWithLogo {
    display: grid;
    grid-template-columns: auto 50px;
    grid-gap: 4px;
  }
}

/* Select button */
[data-scope="select"][data-part="trigger"] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--palette-gray-900);
  background-color: transparent;
  cursor: default;
  border: 0;
  border-radius: 4px;
  height: 36px;
  width: 122px;
  font-size: 16px;
  padding: 12px 16px;
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 1px var(--palette-gray-200);
  }
}

/* Select dropdown menu*/
[data-scope="select"][data-part="content"] {
  color: var(--palette-gray-900);
  background-color: var(--palette-gray-100);
  border: 0;
  border-radius: 4px;
  width: 122px;
  padding: 10px 6px;
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 1px var(--palette-gray-200);
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
  &[data-highlighted] {
    box-shadow: 0 0 0 1px var(--palette-gray-200);
  }

  &:hover,
  [data-highlighted] {
    color: white;
  }

  &[aria-selected="true"] {
    &:hover,
    [data-highlighted] {
      color: var(--palette-gray-900);
    }
    background-color: rgba(250, 250, 250, 0.8);
  }
}

/* Select value text */
[data-scope="select"][data-part="value-text"] {
  display: grid;
  place-items: center;
}

/* Dropdown indicator */
[data-scope="select"][data-part="indicator"] {
  color: var(--palette-gray-500);
}

/* Hide the native select element */
select[aria-hidden="true"] {
  display: none;
}

/* Hide input number arrows */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  appearance: textfield;
}
</style>
