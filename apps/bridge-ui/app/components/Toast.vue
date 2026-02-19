<script setup lang="ts">
import { type createToaster, Toast, Toaster } from "@ark-ui/vue/toast"
import {
	CircleAlertIcon,
	CircleCheckIcon,
	InfoIcon,
	TriangleAlertIcon,
	X
} from "lucide-vue-next"

const { toaster } = defineProps<{
	toaster: ReturnType<typeof createToaster>
}>()

const iconMap = {
	success: CircleCheckIcon,
	error: CircleAlertIcon,
	warning: TriangleAlertIcon,
	info: InfoIcon
}
</script>

<template>
  <div>
    <!-- <div style="display: flex; gap: 12px; flex-wrap: wrap">
      <button
        type="button"
        @click='
          toaster.success({
          	title: "Success!",
          	description: "Your changes have been saved."
          })
        '>
        Success
      </button>
      <button
        type="button"
        @click='
          toaster.error({
          	title: "Error occurred",
          	description: "Something went wrong. Please try again.",
          	duration: Infinity
          })
        '>
        Error
      </button>
      <button
        type="button"
        @click='
          toaster.warning({
          	title: "Warning",
          	description: "This action cannot be undone."
          })
        '>
        Warning
      </button>
      <button
        type="button"
        @click='
          toaster.info({
          	title: "New update available",
          	description: "Version 2.1.0 is now available for download."
          })
        '>
        Info
      </button>
    </div> -->

    <Toaster :toaster #default="toast">
      <Toast.Root>
        <div class="Layout">
          <div class="Top">
            <div class="Icon">
              <component
                :is="
                  toast.type
                  ? iconMap[toast.type as keyof typeof iconMap]
                  : InfoIcon
                "
              />
            </div>
            <Toast.Title>{{ toast.title }}</Toast.Title>
            <Toast.CloseTrigger> <X /> </Toast.CloseTrigger>
          </div>
          <div class="Bottom">
            <Toast.Description>{{ toast.description }}</Toast.Description>
          </div>
        </div>
      </Toast.Root>
    </Toaster>
  </div>
</template>
<style lang="postcss" scoped>
.Layout {
  display: grid;
  gap: 0.25rem;
  .Top {
    .Icon {
      height: 1.5rem;
      width: 1.5rem;
    }
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 1rem;
  }
  .Bottom {
    padding: 0 calc(1.5rem + 1rem);
    display: flex;
  }
}
[data-scope="toast"][data-part="root"] {
  translate: var(--x) var(--y);
  scale: var(--scale);
  z-index: var(--z-index);
  height: var(--height);
  opacity: var(--opacity);
  margin-top: 5rem;
  will-change: translate, opacity, scale;
  transition:
    translate 400ms,
    scale 400ms,
    opacity 400ms,
    height 400ms,
    box-shadow 200ms;
  transition-timing-function: cubic-bezier(0.21, 1.02, 0.73, 1);
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Toast state transitions */
[data-scope="toast"][data-part="root"][data-state="closed"] {
  transition: translate 400ms, scale 400ms, opacity 200ms;
  transition-timing-function: cubic-bezier(0.06, 0.71, 0.55, 1);
}

/* Toast variants */
[data-scope="toast"][data-part="root"][data-type="error"] {
  background: var(--palette-persianRed-100);
  color: var(--palette-persianRed-600);
  border: 1px solid var(--palette-persianRed-300);
  [data-part="description"],
  [data-part="close-trigger"] {
    color: var(--palette-gray-700);
  }
}

[data-scope="toast"][data-part="root"][data-type="info"] {
  background: rgba(10, 132, 255, 0.85);
  color: white;
}

[data-scope="toast"][data-part="root"][data-type="warning"] {
  background: rgba(255, 159, 10, 0.85);
  color: black;
}

[data-scope="toast"][data-part="root"][data-type="success"] {
  background: rgba(52, 199, 89, 0.85);
  color: white;
}

/* Toast content styling */
[data-scope="toast"][data-part="root"] > div:first-child {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
}

[data-scope="toast"][data-part="title"] {
  font-weight: 600;
  font-size: 1rem;
  line-height: 1.2;
}

[data-scope="toast"][data-part="description"] {
  font-size: 0.875rem;
  width: max-content;
  max-width: 50ch;
  opacity: 0.8;
  line-height: 1.3;
}

[data-scope="toast"][data-part="close-trigger"] {
  flex-shrink: 0;
  cursor: pointer;
  background: none;
  border: none;
  color: inherit;
  opacity: 0.6;
  transition: opacity 0.2s;
}

[data-scope="toast"][data-part="close-trigger"]:hover {
  opacity: 1;
}

/* Media queries for responsiveness */
@media (max-width: 640px) {
  [data-scope="toast"][data-part="group"] {
    width: 100%;
  }

  [data-scope="toast"][data-part="root"] {
    inset-inline: 0;
    width: calc(100% - var(--gap) * 2);
    border-radius: 0.5rem;
  }
}
</style>
