<script setup lang="ts">
defineArt("../../../layer/app/components/svg/ZekoLogo.vue", {
	title: "Layer SVG Icons",
	category: "Layer",
	status: "trial",
	tags: ["svg", "icons", "design-system", "layer"]
})
</script>

<art>
  <variant name="Brand" default>
    <div class="IconGrid">
      <div><SvgZekoLogo /><span>ZekoLogo</span></div>
      <div><SvgZekoLogoRings /><span>ZekoLogoRings</span></div>
      <div><SvgZekoBigRings /><span>ZekoBigRings</span></div>
      <div><SvgAuro /><span>Auro</span></div>
    </div>
  </variant>

  <variant name="Tokens">
    <div class="IconGrid">
      <div><SvgZekoToken /><span>ZekoToken</span></div>
      <div><SvgMinaToken /><span>MinaToken</span></div>
      <div><SvgMinaLogo /><span>MinaLogo</span></div>
    </div>
  </variant>

  <variant name="Controls">
    <div class="IconGrid">
      <div><SvgPlus /><span>Plus</span></div>
      <div><SvgCheck /><span>Check</span></div>
      <div><SvgClose /><span>Close</span></div>
      <div><SvgCaretDown /><span>CaretDown</span></div>
      <div><SvgMiniCaretUp /><span>MiniCaretUp</span></div>
      <div><SvgHamburger /><span>Hamburger</span></div>
      <div><SvgMGlass /><span>MGlass</span></div>
    </div>
  </variant>

  <variant name="Status">
    <div class="IconGrid">
      <div><SvgPendingClock /><span>PendingClock</span></div>
      <div><SvgCompletedCircle /><span>CompletedCircle</span></div>
      <div><SvgCancelledCircle /><span>CancelledCircle</span></div>
      <div><SvgErrorCircle /><span>ErrorCircle</span></div>
    </div>
  </variant>

  <variant name="Social">
    <div class="IconGrid">
      <div><SvgSocialDiscord /><span>Discord</span></div>
      <div><SvgSocialGithub /><span>Github</span></div>
      <div><SvgSocialTelegram /><span>Telegram</span></div>
      <div><SvgSocialX /><span>X</span></div>
    </div>
  </variant>

  <variant name="Numbers and audio">
    <div class="IconGrid">
      <div><SvgNumbersOne /><span>One</span></div>
      <div><SvgNumbersTwo /><span>Two</span></div>
      <div><SvgSpeaker /><span>Speaker muted</span></div>
      <div><SvgSpeaker :is-muted="false" /><span>Speaker active</span></div>
    </div>
  </variant>
</art>

<style scoped>
.IconGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: 1rem;
  width: min(48rem, 100vw);
}

.IconGrid > div {
  display: grid;
  place-items: center;
  gap: 0.625rem;
  min-height: 8rem;
  padding: 1rem;
  border: 1px solid var(--theme-light-border-secondary);
  border-radius: 0.5rem;
  background: var(--theme-light-background-secondary);
  color: var(--theme-light-content-primary);
  font-size: var(--typography_fluid-lexend-xs);
}

.IconGrid svg {
  max-width: 5rem;
  max-height: 4rem;
}
</style>
