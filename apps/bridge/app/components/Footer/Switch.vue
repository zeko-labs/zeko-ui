<script lang="ts" setup>
const model = defineModel()

</script>
<template>
  <div class="switch-button">
    <input class="switch-button-checkbox" type="checkbox" v-model="model"></input>
    <label class="switch-button-label" for="">
        <span class="switch-button-label-span">Builders</span>
    </label>
  </div>
</template>

<style lang="postcss" scoped>
* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

body:has(.switch-button-checkbox:checked) {
  .switch-button-label {
    color: white;
  }
  .switch-button:before {
    color: var(--colors-gray-950);
  }
}

.switch-button-label {
  color: var(--colors-gray-950);
  transition: all 300ms;
}

.switch-button {
  background: var(--colors-gray-950);
  border-radius: 30px;
  overflow: hidden;
  width: 240px;
  text-align: center;
  font-size: 18px;
  letter-spacing: 1px;
  position: relative;
  padding-right: 120px;
  position: relative;
}
.switch-button:before {
  content: "Users";
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
  pointer-events: none;
  transition: all 300ms;
}

.switch-button-checkbox {
  cursor: pointer;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  z-index: 2;
}
.switch-button-checkbox:checked + .switch-button-label:before {
  transform: translateX(120px);
  transition: transform 300ms linear;
}
.switch-button-checkbox + .switch-button-label {
  position: relative;
  padding: 15px 0;
  display: block;
  user-select: none;
  pointer-events: none;
}
.switch-button-checkbox + .switch-button-label:before {
  content: "";
  border: 4px solid var(--colors-gray-950); 
  background: white;
  color: var(--colors-gray-950);
  height: 100%;
  width: 100%;
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 30px;
  transform: translateX(0);
  transition: transform 300ms;
}
.switch-button-checkbox + .switch-button-label .switch-button-label-span {
  position: relative;
}
</style>
