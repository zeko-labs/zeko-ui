<script setup lang="ts">
const config = useRuntimeConfig()

const instructionsExpanded = ref(true)
const sprintsExpanded = ref(true)
const sprints = ref<0 | 1 | 2 | 3 | 4 | 5>(1)
const links = {
	...config.public.links,
	discord: config.public.socials.discord,
	x: {
		1: "https://clicktotweet.com/TKb9I",
		2: "https://clicktotweet.com/NXc3e",
		3: "https://clicktotweet.com/20D1p",
		4: "https://clicktotweet.com/yxV1K",
		5: "https://clicktotweet.com/eQ574"
	}
}

const toggleSprint = (sprintNumber: 1 | 2 | 3 | 4 | 5) => {
	sprints.value = sprints.value === sprintNumber ? 0 : sprintNumber
}
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
                  <li>Chrome browser latest version</li>
                  <li>Auro Wallet Chrome extension latest version installed</li>
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

      <button class="PointBreakdownButton" disabled>Point Breakdown</button>
    </section>

    <hr class="SectionDivider">

    <section class="SprintsSection">
      <div class="SprintsDropdown" :class="{ expanded: sprintsExpanded }">
        <button
          class="SprintsHeader"
          @click="(sprintsExpanded = !sprintsExpanded)">
          <div class="SprintsTitle">
            <span class="SprintsIndicator"></span>
            <h2>zkApp Sprints - Earn Points!</h2>
          </div>
          <SvgMiniCaretUp class="ExpandIcon" />
        </button>

        <hr class="Divider" :class="{ hidden: !sprintsExpanded }">

        <div class="ContentWrapper" :class="{ collapsed: !sprintsExpanded }">
          <div class="SprintsContent">
            <div class="SprintsList">
              <!-- SPRINT ONE -->
              <article class="SprintCard" :class="{ expanded: sprints === 1 }">
                <button
                  class="SprintHeader"
                  type="button"
                  :aria-expanded="sprints === 1"
                  @click="toggleSprint(1)">
                  <div class="SprintIcon">
                    <SvgFaucet />
                  </div>

                  <div class="SprintInfo">
                    <div class="SprintMeta">
                      <span class="SprintNumber">Sprint 1</span>
                      <div class="SprintTitleRow">
                        <h3 class="SprintTitle">Faucet</h3>
                        <span class="SprintPoints">20 Points total</span>
                      </div>
                    </div>
                    <p class="SprintDescription">
                      Setup a new wallet & faucet funds on Zeko testnet
                    </p>
                  </div>
                  <SvgToggleCaret :class="{ expanded: sprints === 1 }" />
                </button>

                <div
                  class="ContentWrapper"
                  :class="{ collapsed: sprints !== 1 }">
                  <div class="SprintDetails">
                    <p class="DetailsIntro">
                      To complete Sprint 1 and earn Leaderboard points:
                    </p>
                    <div class="StepsGrid">
                      <div class="StepIndicator">
                        <div class="StepLine"></div>
                      </div>
                      <div class="StepsList">
                        <div class="Step">
                          <div class="StepContent">
                            <span class="StepDot"></span>
                            <div class="StepText">
                              <p>First you need to get a wallet:</p>
                              <ul>
                                <li>
                                  Visit AuroWallet.com to download and install
                                  the latest Auro Chrome/Firefox/Edge browser
                                  extension wallet, note the seed phase backup
                                  is important.
                                </li>
                              </ul>
                            </div>

                            <a
                              :href="links.auroWallet"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="ActionButton">Download Wallet</a>

                            <ul class="StepInstructions">
                              <li>
                                Change the wallet network to Zeko Testnet.
                              </li>
                              <li>
                                Click the wallet icon in the upper right corner,
                                then follow the instructions to Add Account →
                                Create Account → Enter Account Name → Confirm
                              </li>
                            </ul>
                          </div>
                        </div>

                        <div class="Step">
                          <div class="StepContent">
                            <span class="StepDot"></span>
                            <div class="StepText">
                              <p>Now you can faucet with testnet funds</p>
                              <ul>
                                <li>
                                  Visit the Zeko Faucet using your
                                  Chrome/Firefox/Edge desktop browser
                                </li>
                              </ul>
                            </div>

                            <a
                              :href="links.faucet"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="ActionButton withIcon">
                              <SvgFaucet />
                              <span>Zeko Faucet</span>
                            </a>

                            <ul class="StepInstructions">
                              <li>
                                Enter your Auro Wallet address in Step 2 and
                                click 'Request MINA'
                              </li>
                              <li>
                                You should see a few MINA deposited to your
                                wallet within a few seconds (note you can faucet
                                funds only once for your wallet)
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="Congratulations">
                      <h4 class="CongratsTitle">🎉 Congratulations</h4>
                      <p class="CongratsText">
                        Boom! You did it! Your points will roll onto the
                        leaderboard soon. Share the glory with your X network
                        and get ready for the next quest. 💥
                      </p>
                    </div>

                    <a
                      :href="links.x[1]"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ShareButton">
                      <SvgSocialX />
                      <span>Share on X</span>
                    </a>
                  </div>
                </div>
              </article>

              <!-- SPRINT TWO -->
              <article class="SprintCard" :class="{ expanded: sprints === 2 }">
                <button
                  class="SprintHeader"
                  type="button"
                  :aria-expanded="sprints === 2"
                  @click="toggleSprint(2)">
                  <div class="SprintIcon bridge">
                    <SvgBridgeIn />
                  </div>

                  <div class="SprintInfo">
                    <div class="SprintMeta">
                      <span class="SprintNumber">Sprint 2</span>
                      <div class="SprintTitleRow">
                        <h3 class="SprintTitle">Bridge to Zeko</h3>
                        <span class="SprintPoints dark">20 Points total</span>
                      </div>
                    </div>
                    <p class="SprintDescription">
                      Bridge MINA from Mina devnet to Zeko testnet
                    </p>
                  </div>
                  <SvgToggleCaret :class="{ expanded: sprints === 2 }" />
                </button>

                <div
                  class="ContentWrapper"
                  :class="{ collapsed: sprints !== 2 }">
                  <div class="SprintDetails">
                    <p class="DetailsIntro">
                      To complete Sprint 2 and earn Leaderboard points:
                    </p>
                    <div class="StepsGrid">
                      <div class="StepIndicator">
                        <div class="StepLine"></div>
                      </div>
                      <div class="StepsList">
                        <div class="Step">
                          <div class="StepContent">
                            <span class="StepDot"></span>
                            <div class="StepText">
                              <p>
                                First you need to get some Mina devnet funds:
                              </p>
                              <ul>
                                <li>Visit Mina devnet faucet</li>
                              </ul>
                            </div>

                            <a
                              :href="links.faucet"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="ActionButton">
                              <span>Mina Faucet</span>
                            </a>

                            <ul class="StepInstructions">
                              <li>
                                Switch your Auro wallet network to Mina devnet
                              </li>
                              <li>Enter your wallet address → Click Request</li>
                              <li>
                                Your MINA will be deposited to your wallet
                                within a few minutes (note you can faucet only
                                once per wallet)
                              </li>
                            </ul>
                          </div>
                        </div>

                        <div class="Step">
                          <div class="StepContent">
                            <span class="StepDot"></span>
                            <div class="StepText">
                              <p>
                                Now that you have MINA on Mina devnet, Bridge
                                funds from Mina devnet to Zeko testnet
                              </p>
                              <ul>
                                <li>
                                  Visit the Zeko bridge on your
                                  Chrome/Firefox/Edge desktop browser
                                </li>
                              </ul>
                            </div>

                            <a
                              :href="links.zekoBridge"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="ActionButton withIcon">
                              <SvgBridgeIn />
                              <span>Zeko Bridge</span>
                            </a>

                            <ul class="StepInstructions">
                              <li>
                                Enter an amount to bridge from Mina devnet to
                                Zeko testnet, and follow the Bridge page
                                instructions to completion.
                              </li>
                              <li>
                                Visit the Zeko Community Discord if you have any
                                questions
                              </li>
                            </ul>

                            <a
                              :href="links.discord"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="ActionButton withIcon">
                              <SvgSocialDiscord />
                              <span>Visit Discord</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="Congratulations">
                      <h4 class="CongratsTitle">🎉 Congratulations</h4>
                      <p class="CongratsText">
                        Victory unlocked! Wallet leaderboard points incoming.
                        Blast it on X and gear up for the next quest. 🚀
                      </p>
                    </div>

                    <a
                      :href="links.x[2]"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ShareButton">
                      <SvgSocialX />
                      <span>Share on X</span>
                    </a>
                  </div>
                </div>
              </article>

              <!-- SPRINT THREE -->
              <article class="SprintCard" :class="{ expanded: sprints === 3 }">
                <button
                  class="SprintHeader"
                  type="button"
                  :aria-expanded="sprints === 3"
                  @click="toggleSprint(3)">
                  <div class="SprintIcon swap">
                    <SvgSwap />
                  </div>

                  <div class="SprintInfo">
                    <div class="SprintMeta">
                      <span class="SprintNumber">Sprint 3</span>
                      <div class="SprintTitleRow">
                        <h3 class="SprintTitle">Swap Tokens</h3>
                        <span class="SprintPoints dark">10 Points per day</span>
                      </div>
                    </div>
                    <p class="SprintDescription">
                      Swap using Solis on Zeko testnet
                    </p>
                  </div>

                  <SvgToggleCaret :class="{ expanded: sprints === 3 }" />
                </button>

                <div
                  class="ContentWrapper"
                  :class="{ collapsed: sprints !== 3 }">
                  <div class="SprintDetails">
                    <p class="DetailsIntro">
                      To complete Sprint 3 and earn Leaderboard points:
                    </p>

                    <div class="StepsGrid">
                      <div class="StepIndicator">
                        <div class="StepLine"></div>
                      </div>
                      <div class="StepsList">
                        <div class="Step">
                          <div class="StepContent">
                            <span class="StepDot"></span>
                            <div class="StepText">
                              <p>
                                Visit Solis DEX, powered by Lumina SDK, on your
                                Chrome/Brave/Edge desktop browser
                              </p>
                              <ul>
                                <li>
                                  Make sure you're on Zeko Testnet network
                                </li>
                                <li>
                                  Swap some MINA for tZEKO and vice-versa.
                                </li>
                                <li>tZEKO address 👇</li>
                                <li class="address">
                                  B62qjUhPDbMskxMduyzkyGnK6LZwHksuuYPRjyF4owJM7UWLGJynN36
                                </li>
                              </ul>
                            </div>

                            <a
                              :href="links.solisDex"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="ActionButton">
                              <span>Solis DEX</span>
                            </a>
                          </div>
                        </div>

                        <div class="Step">
                          <div class="StepContent">
                            <span class="StepDot"></span>
                            <ul class="StepInstructions">
                              <li>
                                Earn 1 point for every swap between MINA
                                &lt;&gt; tZEKO, up to 10 points maximum per
                                wallet per day
                              </li>
                              <li>
                                Swap every day to earn extra points (up to 10
                                points per day max per wallet)
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="Congratulations">
                      <h4 class="CongratsTitle">🎉 Congratulations</h4>
                      <p class="CongratsText">
                        Mission complete, leaderboard bump incoming. Share your
                        swap skills on X and prepare for the next quest. 🙌
                      </p>
                    </div>

                    <a
                      :href="links.x[3]"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ShareButton">
                      <SvgSocialX />
                      <span>Share on X</span>
                    </a>

                    <div class="Congratulations">
                      <h4 class="CongratsTitle">Shoutout to Lumina SDK</h4>
                      <p class="CongratsText">
                        Solis is powered by Lumina, a protocol for building DEXs
                        on Zeko & Mina. Visit Lumina to learn more:
                      </p>
                    </div>

                    <a
                      :href="links.lumina"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ShareButton">
                      <span>Visit Lumina</span>
                    </a>
                  </div>
                </div>
              </article>

              <!-- SPRINT FOUR -->
              <article class="SprintCard" :class="{ expanded: sprints === 4 }">
                <button
                  class="SprintHeader"
                  type="button"
                  :aria-expanded="sprints === 4"
                  @click="toggleSprint(4)">
                  <div class="SprintIcon liquidity">
                    <SvgLiquidity />
                  </div>

                  <div class="SprintInfo">
                    <div class="SprintMeta">
                      <span class="SprintNumber">Sprint 4</span>
                      <div class="SprintTitleRow">
                        <h3 class="SprintTitle">Pool Liquidity</h3>
                        <span class="SprintPoints dark">10 Points per day</span>
                      </div>
                    </div>
                    <p class="SprintDescription">
                      Add liquidity to token pools on Zeko
                    </p>
                  </div>

                  <SvgToggleCaret :class="{ expanded: sprints === 4 }" />
                </button>

                <div
                  class="ContentWrapper"
                  :class="{ collapsed: sprints !== 4 }">
                  <div class="SprintDetails">
                    <p class="DetailsIntro">
                      To complete Sprint 4 and earn Leaderboard points, first
                      add the tZEKO &lt;&gt; Mina pool:
                    </p>

                    <div class="StepsGrid">
                      <div class="StepIndicator">
                        <div class="StepLine"></div>
                      </div>
                      <div class="StepsList">
                        <div class="Step">
                          <div class="StepContent">
                            <span class="StepDot"></span>
                            <ul class="StepInstructions">
                              <li>Visit Solis DEX, powered by Lumina SDK</li>
                            </ul>

                            <a
                              :href="links.solisDex"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="ActionButton">
                              <span>Solis DEX</span>
                            </a>

                            <ul class="StepInstructions">
                              <li>Make sure you're on Zeko Testnet network</li>
                              <li>Select 'Pool' from the Menu</li>
                              <li>
                                Click 'Import Pool', and paste the
                                tZEKO&lt;&gt;MINA pool address
                              </li>
                              <li class="address">
                                B62qrSyBR5jLgekkwjDdpt6UX8FfYntYB1uXydFyViWMFLkrGSceFEV
                              </li>
                              <li>Click 'Import Pool'</li>
                            </ul>
                          </div>
                        </div>

                        <div class="Step">
                          <div class="StepContent">
                            <span class="StepDot"></span>
                            <div class="StepText">
                              <p>
                                Now you're ready to add liquidity to the pool:
                              </p>
                            </div>

                            <ul class="StepInstructions">
                              <li>
                                Visit Solis DEX → Click 'Pool' from the Menu,
                                and navigate to → Your Pools
                              </li>
                              <li>
                                Select 'Add Liquidity' action for the MINA /
                                tZEKO pool
                              </li>
                              <li>
                                Enter the token amounts to Pool → click 'Add
                                Liquidity'
                              </li>
                              <li>
                                Earn 5 points for every Add Liquidity action, up
                                to 10 points maximum per wallet per day
                              </li>
                              <li>
                                Add liquidity every day to earn extra points (up
                                to 10 points per day max per wallet)
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="Congratulations">
                      <h4 class="CongratsTitle">🎉 Congratulations</h4>
                      <p class="CongratsText">
                        You are a Pro Pooler! Leaderboard is syncing your points
                        now. Flex your status on X and lock in for the next
                        quest. 🏊
                      </p>
                    </div>

                    <a
                      :href="links.x[4]"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ShareButton">
                      <SvgSocialX />
                      <span>Share on X</span>
                    </a>
                  </div>
                </div>
              </article>

              <!-- SPRINT FIVE -->
              <article class="SprintCard" :class="{ expanded: sprints === 5 }">
                <button
                  class="SprintHeader"
                  type="button"
                  :aria-expanded="sprints === 5"
                  @click="toggleSprint(5)">
                  <div class="SprintIcon bridge">
                    <SvgBridgeOut />
                  </div>

                  <div class="SprintInfo">
                    <div class="SprintMeta">
                      <span class="SprintNumber">Sprint 5</span>
                      <div class="SprintTitleRow">
                        <h3 class="SprintTitle">Bridge to Mina</h3>
                        <span class="SprintPoints dark">20 Points total</span>
                      </div>
                    </div>
                    <p class="SprintDescription">
                      Bridge from Zeko testnet to Mina devnet
                    </p>
                  </div>

                  <SvgToggleCaret :class="{ expanded: sprints === 5 }" />
                </button>

                <div
                  class="ContentWrapper"
                  :class="{ collapsed: sprints !== 5 }">
                  <div class="SprintDetails">
                    <p class="DetailsIntro">
                      To complete Sprint 5 and earn Leaderboard points, Bridge
                      MINA from Zeko testnet to Mina devnet
                      <br>
                      (Easy tip: Sprint 5 bridges in the reverse direction as
                      Sprint 2)
                    </p>
                    <div class="StepsGrid">
                      <div class="StepIndicator">
                        <div class="StepLine"></div>
                      </div>
                      <div class="StepsList">
                        <div class="Step">
                          <div class="StepContent">
                            <span class="StepDot"></span>
                            <div class="StepText">
                              <p>Visit the Zeko bridge</p>
                            </div>

                            <a
                              :href="links.zekoBridge"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="ActionButton withIcon">
                              <SvgBridgeOut />
                              <span>Zeko Bridge</span>
                            </a>

                            <ul class="StepInstructions">
                              <li>
                                Enter an amount to bridge from Zeko testnet to
                                Mina devnet, and follow the Bridge page
                                instructions to completion.
                              </li>
                              <li>
                                Visit the Zeko Community Discord if you have any
                                questions
                              </li>
                            </ul>
                          </div>
                        </div>

                        <div class="Step">
                          <div class="StepContent">
                            <a
                              :href="links.discord"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="ActionButton withIcon">
                              <SvgSocialDiscord />
                              <span>Visit Discord</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="Congratulations">
                      <h4 class="CongratsTitle">🎉 Congratulations</h4>
                      <p class="CongratsText">
                        GG hero, your wallet points are on the way. Sound the
                        horn on X and look out for side quests to max out your
                        level! 🎮
                      </p>
                    </div>

                    <a
                      :href="links.x[5]"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ShareButton">
                      <SvgSocialX />
                      <span>Share on X</span>
                    </a>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  </aside>
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
          color: #5242eb;
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

.SprintsSection {
  display: flex;
  flex-direction: column;
  font-size: var(--typography_fluid-lexend-s);
  font-weight: 400;
  line-height: 1.55;
  .SprintsDropdown {
    background: var(--palette-cosmicGold-lightest);
    border: 1px solid var(--palette-gray-200);
    border-radius: 0.5rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0;
    transition: gap var(--collapse-duration, 0.3s) ease;

    .SprintsHeader {
      all: unset;
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      cursor: pointer;
      .SprintsTitle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        .SprintsIndicator {
          width: 0.5rem;
          height: 0.5rem;
          background: var(--palette-cosmicGold-medium);
          border-radius: 100px;
          flex-shrink: 0;
        }
        h2 {
          font-size: var(--typography_fluid-lexend-m);
          font-weight: 500;
          line-height: 1.55;
          letter-spacing: -0.0175rem;
          color: var(--palette-gray-950);
          margin: 0;
        }
      }
      .ExpandIcon {
        width: 1.5rem;
        height: 1.5rem;
        color: var(--palette-gray-950);
        transform: rotate(180deg);
        transition: transform 0.2s ease;
      }
    }
    &.expanded {
      gap: 0.625rem;
      .ExpandIcon {
        transform: rotate(0deg);
      }
    }
  }
  .SprintsContent {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;

    .SprintsList {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding-left: 0.25rem;
      .SprintCard {
        display: flex;
        flex-direction: column;
        gap: 0;
        border-radius: 0.5rem;
        transition: gap var(--collapse-duration) ease;
        &.expanded {
          gap: 0.5rem;
        }
        .SprintHeader {
          all: unset;
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          width: 100%;
          cursor: pointer;
          text-align: left;
          .SprintIcon {
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
          .SprintInfo {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
            flex: 1;
            .SprintMeta {
              display: flex;
              flex-direction: column;
              gap: 0.125rem;
              .SprintNumber {
                color: var(--palette-gray-950);
              }
              .SprintTitleRow {
                display: flex;
                align-items: center;
                gap: 0.25rem;
                line-height: 1.55;
                .SprintTitle {
                  font-size: var(--typography_fluid-lexend-m);
                  font-weight: 500;
                  letter-spacing: -0.0175rem;
                  color: var(--palette-gray-950);
                  margin: 0;
                }
                .SprintPoints {
                  color: var(--palette-cosmicGold-medium);
                  &.dark {
                    color: var(--palette-cosmicGold-dark);
                  }
                }
              }
            }
            .SprintDescription {
              color: var(--palette-gray-800);
              margin: 0;
            }
          }
        }
        .SprintDetails {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding-left: 3rem;
          .DetailsIntro {
            color: var(--palette-gray-700);
            margin: 0;
          }
          .StepsGrid {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 0.5rem;
            .StepIndicator {
              width: 0.125rem;
              padding-top: 0.5rem;
              .StepLine {
                width: 100%;
                height: 100%;
                background: var(--palette-gray-100);
              }
            }
            .StepsList {
              display: flex;
              flex-direction: column;
              position: relative;
              .Step {
                display: flex;
                gap: 0.5rem;
                .StepContent {
                  display: flex;
                  flex-direction: column;
                  gap: 0.5rem;
                  flex: 1;
                  padding-bottom: 0.5rem;
                  position: relative;
                  .StepDot {
                    position: absolute;
                    left: -0.875rem;
                    top: 0.3125rem;
                    width: 0.625rem;
                    height: 0.625rem;
                    border: 1px solid var(--palette-gray-200);
                    border-radius: 1000px;
                    background: var(--palette-gray-50);
                    flex-shrink: 0;
                  }
                  .StepText {
                    color: var(--palette-gray-700);
                    p {
                      margin: 0 0 0.5rem 0;
                    }
                    ul {
                      margin: 0;
                      padding-left: 1.125rem;
                    }
                  }

                  .ActionButton {
                    all: unset;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.25rem;
                    padding: 0.75rem 1rem;
                    border-radius: 0.5rem;
                    color: var(--palette-gray-950);
                    text-decoration: none;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                    /* Gradient Border */
                    --bg: var(--palette-cosmicGold-lightest);
                    background:
                      linear-gradient(var(--bg), var(--bg)) padding-box,
                      var(--gradients-goldGradient-button-main-2) border-box;
                    border: 1px solid transparent;
                    &:hover {
                      --bg: var(--palette-yellow-50);
                    }
                    &.withIcon {
                      gap: 0.5rem;
                    }
                    svg {
                      width: 1.125rem;
                      height: 1.125rem;
                    }
                  }
                  .StepInstructions {
                    color: var(--palette-gray-700);
                    margin: 0;
                    padding-left: 1.125rem;
                  }
                  li {
                    margin: 0;
                    &.address {
                      overflow-wrap: break-word;
                      word-break: break-all;
                    }
                  }
                }
                &:last-child {
                  .StepContent {
                    padding-bottom: 0;
                  }
                }
              }
            }
          }
          .Congratulations {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            .CongratsTitle {
              font-size: 1rem;
              font-weight: 500;
              line-height: 1.55;
              letter-spacing: -0.01rem;
              color: var(--palette-gray-950);
              margin: 0;
            }
            .CongratsText {
              color: var(--palette-gray-700);
              margin: 0;
            }
          }
          .SharePrompt {
            color: var(--palette-gray-700);
            margin: 0;
          }
          .ShareButton {
            all: unset;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            background: var(--palette-cosmicGold-lightest);
            border: 1px solid var(--palette-gray-200);
            border-radius: 0.5rem;
            color: var(--palette-gray-950);
            text-decoration: none;
            cursor: pointer;
            transition: background-color 0.2s ease;
            &:hover {
              background: var(--palette-gray-50);
            }
            svg {
              width: 1.125rem;
              height: 1.125rem;
            }
          }
        }
      }
    }
  }
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
</style>
