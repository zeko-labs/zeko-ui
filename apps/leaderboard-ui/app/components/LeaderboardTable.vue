<script lang="ts" setup>
import { Field } from "@ark-ui/vue/field"
import NumberFlow from "@number-flow/vue"

const lb = useLeaderboard()

const openLink = (wallet: string) => {
	const url = `https://zekoscan.io/testnet/account/${wallet}/txs`
	window.open(url, "_blank")
}
</script>

<template>
  <div class="TableWrapper">
    <div class="TableContainer">
      <header class="Header">
        <div class="Text">
          <div class="Title">Leaderboard</div>
          <!-- <div class="SubTitle">Real Time Updates</div> -->
        </div>
        <div class="Controls">
          <Field.Root>
            <div class="SearchWrapper">
              <div class="SearchIcon">
                <SvgMGlass />
              </div>
              <Field.Input
                type="text"
                v-model="lb.search"
                placeholder="Search your wallet"
              />
            </div>
          </Field.Root>
        </div>
      </header>
      <hr>
      <div class="LeaderboardTable">
        <div class="Summary">
          <div>ZEKOs</div>

          <div>
            <NumberFlow
              class="Count"
              :value="lb.totalPoints"
              :format='{ notation: "standard", useGrouping: true }'
            />
            <span>&nbsp;points earned</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th
                v-for="h of lb.table.getHeaderGroups()[0]?.headers"
                :key="h.id"
                :class="h.column.columnDef.header">
                {{ h.column.columnDef.header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="lb.fetching && lb.entries.length === 0">
              <td :colspan="lb.table.getHeaderGroups()[0]?.headers.length">
                Loading…
              </td>
            </tr>
            <tr
              v-for="row of lb.table.getRowModel().rows"
              :key="row.id"
              @click='openLink(row.getValue("wallet"))'>
              <td class="Rank">{{ row.getValue("rank") }}</td>
              <td class="Wallet">{{ row.getValue("wallet") }}</td>
              <td class="Points">{{ row.getValue("score") }}</td>
            </tr>
            <tr v-if="!lb.fetching && lb.entries.length === 0">
              <td :colspan="lb.columns.length">No entries.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <Pagination />
  </div>
</template>

<style lang="postcss" scoped>
.TableWrapper {
  grid-area: table;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  .TableContainer {
    display: flex;
    flex-direction: column;
    background: white;
    padding: 1.5rem 1rem;
    @media not (--phone) {
      padding: 1.5rem;
    }
    border-radius: 1rem;
    border: 1px solid var(--palette-gray-300);
    box-shadow: 16px 16px 24px 0 rgba(122, 122, 122, 0.15);
    gap: 0.75rem;

    hr {
      border: none;
      height: 1px;
      background-color: var(--palette-gray-200);
      width: 100%;
      margin: 0;
    }
  }
}

.Header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  @media (--small-desktop) {
    flex-direction: row;
    justify-content: space-between;
  }
  .Text {
    line-height: 155%;
    .Title {
      font-size: var(--typography_fluid-lexend-l);
      font-weight: 500;
      letter-spacing: -0.01125rem;
    }
    .SubTitle {
      color: var(--palette-gray-800);
      font-size: var(--typography_fluid-lexend-m);
      font-weight: 400;
      letter-spacing: -0.0175rem;
    }
  }
  .Controls {
    .SearchWrapper {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.625rem;
      border: 1px solid var(--palette-gray-300);
      width: 100%;
      border-radius: 0.5rem;
      padding: 0.5rem;
      &:has(input:focus) {
        border-color: var(--palette-cosmicGold-50);
        box-shadow: 0 0 0 3px
          oklch(from var(--palette-cosmicGold-50) l c h / 0.4);
      }
    }

    .SearchIcon {
      display: grid;
      place-items: center;
      svg {
        height: 1.25rem;
        width: 1.25rem;
      }
    }

    input {
      all: unset;
    }
  }
}

.LeaderboardTable {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  .Summary {
    display: flex;
    justify-content: space-between;
  }
}

table {
  display: flex;
  gap: 0.5rem;
  flex-direction: column;
  max-width: 100vw;
  width: 100%;
  border-collapse: collapse;
}
tr {
  display: grid;
  grid-template-columns: minmax(auto, 4rem) 1fr minmax(auto, 8.125rem);
  border: none;
  width: 100%;
}
th,
td {
  &.Rank {
    display: grid;
    place-items: center;
  }
  &.Points {
    display: grid;
    place-items: center;
  }
}
thead {
  background: var(--palette-gray-50);
  border-radius: 0.5rem;
  padding: 0.75rem 0;
  th {
    &.Wallet {
      text-align: left;
    }
    color: var(--palette-gray-800);
    font-size: var(--typography_fluid-lexend-m);
    font-weight: 500;
    line-height: 155%;
    letter-spacing: -0.0175rem;
  }
}
tbody {
  width: 100%;
  tr {
    cursor: pointer;
    padding: 1.5rem 0;
    border-bottom: 1px solid var(--palette-gray-200);
    &:has(+ tr:hover) {
      border-bottom: 1px solid transparent;
    }
    &:hover {
      background: var(--palette-gray-50);
      border-bottom: 1px solid transparent;
      border-radius: 0.5rem;
    }
    &:last-child {
      border-bottom: none;
    }
  }

  td {
    text-wrap: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.Pagination {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
