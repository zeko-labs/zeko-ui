<script setup lang="ts">
const condition1 = ref(false)
const condition2 = ref(false)
const complexConditionValue = ref(true)

const toggleCondition1 = () => {
	condition1.value = !condition1.value
}

const toggleCondition2 = () => {
	condition2.value = !condition2.value
}

const complexCondition = () => complexConditionValue.value

const toggleComplexCondition = () => {
	complexConditionValue.value = !complexConditionValue.value
}

const alwaysTrue = () => true
const alwaysFalse = () => false
</script>

<template>
  <div class="test-container">
    <h1>Switch Component Test</h1>

    <div class="test-case">
      <h2>Test Case 1: Basic Functionality</h2>
      <template v-if="condition1">
        <div class="match-result">Condition 1 is true</div>
      </template>
      <template v-else-if="condition2">
        <div class="match-result">Condition 2 is true</div>
      </template>
      <template v-else>
        <div class="fallback-result">Fallback: No conditions met</div>
      </template>
      <div class="controls">
        <button @click="toggleCondition1">Toggle Condition 1</button>
        <button @click="toggleCondition2">Toggle Condition 2</button>
      </div>
    </div>

    <div class="test-case">
      <h2>Test Case 2: Function Condition</h2>
      <template v-if="complexCondition()">
        <div class="match-result">Complex condition is true</div>
      </template>
      <template v-else>
        <div class="fallback-result">
          Fallback: Complex condition is false
        </div>
      </template>
      <div class="controls">
        <button @click="toggleComplexCondition">
          Toggle Complex Condition
        </button>
      </div>
    </div>

    <div class="test-case">
      <h2>Test Case 3: Multiple Matches</h2>
      <template v-if="alwaysTrue()">
        <div class="match-result">This should always show (1)</div>
        <div class="match-result">
          This should also show if multiple matches are returned (2)
        </div>
      </template>
      <template v-else>
        <div class="fallback-result">This fallback should never show</div>
      </template>
    </div>

    <div class="test-case">
      <h2>Test Case 4: No Matches</h2>
      <template v-if="alwaysFalse()">
        <div class="match-result">This should never show</div>
      </template>
      <template v-else>
        <div class="fallback-result">This fallback should show</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.test-container {
  font-family: Arial, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.test-case {
  border: 1px solid #ccc;
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 5px;
}

.match-result, .fallback-result {
  padding: 10px;
  margin: 10px 0;
  border-radius: 3px;
}

.match-result {
  background-color: #e6f7ff;
  border: 1px solid #91d5ff;
}

.fallback-result {
  background-color: #fff7e6;
  border: 1px solid #ffd591;
}

.controls {
  margin-top: 10px;
}

button {
  margin-right: 10px;
  padding: 5px 10px;
  cursor: pointer;
}
</style>
