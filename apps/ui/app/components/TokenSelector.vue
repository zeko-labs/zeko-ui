<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { Field } from "@ark-ui/vue/field"
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { Select, createListCollection } from "@ark-ui/vue/select"
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { ChevronDownIcon } from "lucide-vue-next"
import { theme } from "~~/helpers/theme"

const collection = createListCollection({
	items: ["MINA", "ZEKO"]
})

const colors = theme.config.colors
</script>

<template>
  <div class="SelectWrapper">
    <Field.Root>
      <Field.Input type="number" />
    </Field.Root>
    <Field.Root>
      <Select.Root :collection :default-value='["MINA"]'>
        <Select.Control asChild>
          <div class="TriggerWrapper">
            <Select.Trigger>
              <div class="TriggerContent">
                <div class="TextWithLogo">
                  <SvgMinaToken width="24" height="24" />
                  <Select.ValueText placeholder="Placeholder" />
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
                <Select.ItemGroupLabel>Tokens</Select.ItemGroupLabel>
                <Select.Item v-for="item of collection.items" :key="item" :item>
                  <!-- <Select.ItemContext>OK</Select.ItemContext> -->
                  <Select.ItemText>
                    {{ item }}
                  </Select.ItemText>
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
  display: inline-flex;
  background-color: v-bind("colors.spaceBlue.value");
  border-radius: 8px;
  border: 1px solid v-bind("colors.gray[200].value");
  overflow: hidden;
  max-width: 500px;
}

span, input {
  font-family: Lexend;
  font-weight: 400;
}

/* Input field */
[data-scope="field"][data-part="input"] {
  background: transparent;
  border: none;
  color: v-bind("colors.gray[900].value");
  font-size: 1.125rem;
  padding: 12px 16px;
  outline: none;
  height: 100%;
}

/* Select container */
[data-scope="select"][data-part="root"] {
  min-width: 120px;
}

.TriggerWrapper {
  padding: 10px 8px;
  background-color: v-bind("colors.spaceBlue.value");
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
  color: v-bind("colors.gray[900].value");
  background-color: v-bind("colors.gray[100].value");
  cursor: pointer;
  border: 0;
  border-radius: 4px;
  height: 36px;
  width: 122px;
  font-size: 16px;
  padding: 12px 16px;
  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 1px v-bind("colors.gray[200].value");
  }
}

/* Select dropdown menu*/
[data-scope="select"][data-part="content"] {
  color: v-bind("colors.gray[900].value");
  background-color: v-bind("colors.gray[100].value");
  border: 0;
  border-radius: 4px;
  width: 122px;
  padding: 10px 6px;
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

/* Select value text */
[data-scope="select"][data-part="value-text"] {
  display: grid;
  place-items: center;
}

/* Dropdown indicator */
[data-scope="select"][data-part="indicator"] {
  color: v-bind("colors.gray[500].value");
}

/* Hide the native select element */
select[aria-hidden="true"] {
  display: none;
}
</style>
