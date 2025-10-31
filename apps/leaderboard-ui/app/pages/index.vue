<script setup lang="ts">
const search = ref("")
</script>
<template>
  <div class="LeaderBoardPage">
    <header class="Header">
      <h1>Leaderboard</h1>
      <div class="Controls">
        <input v-model="search" placeholder="Search your wallet" />
      </div>
    </header>

    <LeaderboardTable :search />
  </div>
</template>

<style scoped>
.LeaderBoardPage {
  max-width: 920px;
  margin: 2rem auto;
  background: white;
  border-radius: 12px;
  padding: 1rem;
}
.Header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.Controls input {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #e6e6e6;
}
</style>
