<script setup lang="ts">
import { Dialog, useDialog } from "@ark-ui/vue/dialog"

const instructionsExpanded = ref(true)

const pointsBreakdownDialog = useDialog({ closeOnInteractOutside: true })

const openPointsBreakdown = () => {
	pointsBreakdownDialog.value.setOpen(true)
}

const closePointsBreakdown = () => {
	pointsBreakdownDialog.value.setOpen(false)
}

const pointsBreakdown = [
	{ sprint: 1, name: "Faucet", points: "20 points" },
	{ sprint: 2, name: "Bridge to Zeko", points: "20 points" },
	{ sprint: 3, name: "Swap Tokens", points: "10 points per day" },
	{ sprint: 4, name: "Pool Liquidity", points: "10 points per day" },
	{ sprint: 5, name: "Bridge to Mina", points: "20 points" }
]
</script>

<template>
  <aside class="Instructions">
    <section class="WelcomeSection">
      <div class="WelcomeContent">
        <h2 class="Title">Welcome to the ZekoBOOM Ignition Phase!</h2>
        <p class="Description">
          Get ready for Zeko launch by participating in exciting Sprints where
          you can earn big points and compete for a top spot on the leaderboard.
        </p>
      </div>

      <div
        class="InstructionDropdown"
        :class="{ expanded: instructionsExpanded }">
        <button
          class="InstructionHeader"
          @click="(instructionsExpanded = !instructionsExpanded)">
          <div class="InstructionTitle">
            <span class="Indicator"></span>
            <span>Instructions</span>
          </div>
          <SvgMiniCaretUp class="DropdownIcon" />
        </button>

        <hr class="Divider" :class="{ hidden: !instructionsExpanded }">

        <div
          class="ContentWrapper"
          :class="{ collapsed: !instructionsExpanded }">
          <div class="InstructionContent">
            <div class="InstructionList">
              <div class="InstructionItem">
                <h3 class="ItemTitle">How to Join ZekoBOOM Sprints?</h3>
                <p class="ItemText">
                  Visit the zkApp Sprints section below and follow the
                  instructions to complete all the main tasks to earn points.
                </p>
              </div>

              <div class="InstructionItem">
                <h3 class="ItemTitle">
                  Win Big Points and Rank UP on the Leaderboard
                </h3>
                <p class="ItemText">
                  The more points you earn, the higher you climb on the
                  leaderboard. Top points earners will be very happy.
                </p>
              </div>

              <div class="InstructionItem">
                <h3 class="ItemTitle">Tech Requirements</h3>
                <ul class="RequirementsList">
                  <li>Chrome/Firefox/Edge desktop browser latest version</li>
                  <li>
                    Auro Wallet desktop browser extension latest version
                    installed
                  </li>
                </ul>
                <div class="DownloadLink">
                  <span class="LinkText">Auro Wallet not installed?</span>
                  <a
                    href="https://www.aurowallet.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="LinkAction">Download here</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button class="PointBreakdownButton" @click="openPointsBreakdown">
        Leaderboard Points Breakdown
      </button>
    </section>

    <hr class="SectionDivider">

    <InstructionsSprints />
  </aside>
  <Dialog.RootProvider :value="pointsBreakdownDialog">
    <Teleport to="body">
      <Dialog.Backdrop class="PointsDialogBackdrop" />
      <Dialog.Positioner class="PointsDialogPositioner">
        <Dialog.Content class="PointsDialogContent">
          <div class="PointsDialogHeader">
            <Dialog.Title class="PointsDialogTitle">
              Complete Sprints to Earn Points
            </Dialog.Title>
            <Dialog.CloseTrigger
              class="PointsDialogClose"
              @click="closePointsBreakdown">
              <SvgClose />
            </Dialog.CloseTrigger>
          </div>

          <div class="PointsDialogTable">
            <div class="PointsDialogTableHeader">
              <div class="PointsDialogHeaderCell">Sprint</div>
              <div class="PointsDialogHeaderCell">Points</div>
            </div>

            <div class="PointsDialogTableBody">
              <div
                v-for="item in pointsBreakdown"
                :key="item.sprint"
                class="PointsDialogTableRow">
                <div class="PointsDialogSprintCell">
                  <div class="PointsDialogIcon">
                    <SvgFaucet v-if="item.sprint === 1" />
                    <SvgBridgeIn v-else-if="item.sprint === 2" />
                    <SvgSwap v-else-if="item.sprint === 3" />
                    <SvgLiquidity v-else-if="item.sprint === 4" />
                    <SvgBridgeOut v-else-if="item.sprint === 5" />
                  </div>
                  <div class="PointsDialogSprintInfo">
                    <span class="PointsDialogSprintNumber">
                      Sprint {{ item.sprint }}
                    </span>
                    <span class="PointsDialogSprintName">{{ item.name }}</span>
                  </div>
                </div>
                <div class="PointsDialogPointsCell">{{ item.points }}</div>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Teleport>
  </Dialog.RootProvider>
</template>

<style lang="postcss" scoped>
.Instructions {
  --collapse-duration: 0.3s;
  grid-area: instructions;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: white;
  border: 1px solid var(--palette-gray-300);
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 8px 8px 24px 0 rgba(137, 137, 137, 0.15);
  height: fit-content;
}

.WelcomeSection {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  .WelcomeContent {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    border-radius: 0.5rem;
    .Title {
      font-size: var(--typography_fluid-lexend-xl);
      font-weight: 500;
      line-height: 1.55;
      letter-spacing: -0.01125rem;
      color: var(--palette-gray-950);
      margin: 0;
    }

    .Description {
      font-size: var(--typography_fluid-lexend-m);
      font-weight: 400;
      line-height: 1.55;
      letter-spacing: -0.0175rem;
      color: var(--palette-gray-800);
      margin: 0;
    }
  }
}

.InstructionDropdown {
  background: var(--palette-cosmicGold-lightest);
  border: 1px solid var(--palette-gray-200);
  border-radius: 0.5rem;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0;
  transition: gap var(--collapse-duration, 0.3s) ease;

  .InstructionHeader {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    cursor: pointer;
    .InstructionTitle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: var(--typography_fluid-lexend-m);
      font-weight: 400;
      line-height: 1.55;
      letter-spacing: -0.0175rem;
      color: var(--palette-gray-950);
      .Indicator {
        width: 0.5rem;
        height: 0.5rem;
        background: var(--palette-cosmicGold-50);
        border-radius: 100px;
        flex-shrink: 0;
      }
    }
    .DropdownIcon {
      width: 1.5rem;
      height: 1.5rem;
      color: var(--palette-gray-950);
      transform: rotate(180deg);
      transition: transform 0.2s ease;
    }
  }
  &.expanded {
    gap: 0.625rem;
    .DropdownIcon {
      transform: rotate(0deg);
    }
  }
}

.InstructionContent {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  .InstructionList {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    .InstructionItem {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-weight: 400;
      line-height: 1.55;
      .ItemTitle {
        font-size: var(--typography_fluid-lexend-m);
        letter-spacing: -0.0175rem;
        font-weight: 400;
        color: var(--palette-gray-950);
        margin: 0;
      }
      .ItemText {
        font-size: var(--typography_fluid-lexend-s);
        color: var(--palette-gray-700);
        margin: 0;
      }

      .RequirementsList {
        font-size: var(--typography_fluid-lexend-s);
        color: var(--palette-gray-700);
        margin: 0;
        padding-left: 1.125rem;
        li {
          margin: 0;
        }
      }
      .DownloadLink {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: var(--typography_fluid-lexend-s);
        letter-spacing: -0.015rem;
        .LinkText {
          color: var(--palette-gray-700);
        }
        .LinkAction {
          color: hsla(246, 81%, 59%, 1);
          text-decoration: none;
          &:hover {
            text-decoration: underline;
          }
        }
      }
    }
  }
}

.PointBreakdownButton {
  all: unset;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: var(--gradients-goldGradient-button-main-2);
  font-size: var(--typography_fluid-lexend-m);
  font-weight: 500;
  line-height: 1.55;
  letter-spacing: -0.0175rem;
  color: var(--palette-gray-950);
  cursor: pointer;
  transition: opacity 0.2s ease;
  &:not(:disabled):hover {
    opacity: 0.9;
  }
  &:disabled {
    cursor: not-allowed;
  }
}

.SectionDivider {
  border: none;
  height: 1px;
  background-color: var(--palette-gray-200);
  margin: 0;
}

.Divider {
  border: none;
  height: 1px;
  background-color: var(--palette-gray-200);
  margin: 0;
}

.ContentWrapper {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows var(--collapse-duration) ease;

  > * {
    overflow: hidden;
  }

  &.collapsed {
    grid-template-rows: 0fr;
  }
}

.hidden {
  display: none;
}

.PointsDialogBackdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 10;
  animation: fadeIn 0.2s ease-in-out;

  &[data-state="closed"] {
    animation: fadeOut 0.2s ease-in-out;
    display: none;
  }
}

.PointsDialogPositioner {
  position: fixed;
  inset: 0;
  z-index: 11;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  overflow-y: auto;

  &[aria-hidden="true"],
  &[data-aria-hidden="true"],
  &[hidden] {
    display: none;
  }

  .PointsDialogContent {
    position: relative;
    border-radius: 1rem;
    padding: 2rem;
    max-width: 45rem;
    width: 100%;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;

    /* Gradient border effect */
    --bg: white;
    background:
      linear-gradient(var(--bg), var(--bg)) padding-box,
      var(--gradients-goldGradient-button-main-2) border-box;
    border: 2px solid transparent;

    &[data-state="open"] {
      animation: scaleIn 0.2s ease-out;
    }

    &[data-state="closed"] {
      animation: scaleOut 0.2s ease-out;
    }

    &[aria-hidden="true"],
    &[data-aria-hidden="true"],
    &[hidden] {
      display: none;
    }

    @media not (--desktop) {
      padding: 1.5rem;
      max-height: 90vh;
      overflow-y: auto;
    }
  }

  .PointsDialogHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;

    .PointsDialogTitle {
      font-size: var(--typography_fluid-lexend-xl);
      font-weight: 600;
      color: var(--palette-gray-950);
      margin: 0;
      flex: 1;
    }
  }

  .PointsDialogClose {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
    border-radius: 0.25rem;
    transition: background-color 0.2s ease;
    flex-shrink: 0;

    &:hover {
      background: var(--palette-gray-100);
    }

    &:focus-visible {
      outline: 2px solid var(--palette-cosmicGold-100);
      outline-offset: 2px;
    }

    svg {
      width: 1.25rem;
      height: 1.25rem;
      color: var(--palette-gray-700);
    }
  }

  .PointsDialogTable {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--palette-gray-200);
    border-radius: 0.5rem;
    overflow: hidden;

    .PointsDialogTableHeader {
      display: grid;
      grid-template-columns: 1fr auto;
      background: var(--gradients-goldGradient-button-main-2);
      border-bottom: 1px solid var(--palette-gray-200);
    }

    .PointsDialogHeaderCell {
      padding: 0.75rem 1rem;
      font-size: var(--typography_fluid-lexend-s);
      font-weight: 600;
      color: var(--palette-gray-950);
      text-align: left;

      &:last-child {
        text-align: right;
      }
    }

    .PointsDialogTableBody {
      display: flex;
      flex-direction: column;
    }

    .PointsDialogTableRow {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid var(--palette-gray-100);

      &:last-child {
        border-bottom: none;
      }

      &:hover {
        background: var(--palette-gray-50);
      }
    }

    .PointsDialogSprintCell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .PointsDialogIcon {
      width: 2.5rem;
      height: 2.5rem;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.5rem;
      overflow: hidden;

      svg {
        width: 100%;
        height: 100%;
      }
    }

    .PointsDialogSprintInfo {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .PointsDialogSprintNumber {
      font-size: var(--typography_fluid-lexend-s);
      color: var(--palette-gray-700);
    }

    .PointsDialogSprintName {
      font-size: var(--typography_fluid-lexend-m);
      font-weight: 500;
      color: var(--palette-gray-950);
    }

    .PointsDialogPointsCell {
      font-size: var(--typography_fluid-lexend-m);
      font-weight: 500;
      color: var(--palette-cosmicGold-dark);
      text-align: right;
      padding-right: 0.5rem;
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes scaleOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>
