import FooterSocial from "../../layer/app/components/FooterSocial.vue"
import Label from "../../layer/app/components/Label.vue"
import NavigationIndex from "../../layer/app/components/Navigation/Index.vue"
import NavigationItem from "../../layer/app/components/Navigation/Item.vue"
import NavigationSound from "../../layer/app/components/Navigation/Sound.vue"
import SvgAuro from "../../layer/app/components/svg/Auro.vue"
import SvgCancelledCircle from "../../layer/app/components/svg/CancelledCircle.vue"
import SvgCaretDown from "../../layer/app/components/svg/CaretDown.vue"
import SvgCheck from "../../layer/app/components/svg/Check.vue"
import SvgClose from "../../layer/app/components/svg/Close.vue"
import SvgCompletedCircle from "../../layer/app/components/svg/CompletedCircle.vue"
import SvgErrorCircle from "../../layer/app/components/svg/ErrorCircle.vue"
import SvgHamburger from "../../layer/app/components/svg/Hamburger.vue"
import SvgMGlass from "../../layer/app/components/svg/MGlass.vue"
import SvgMinaLogo from "../../layer/app/components/svg/MinaLogo.vue"
import SvgMinaToken from "../../layer/app/components/svg/MinaToken.vue"
import SvgMiniCaretUp from "../../layer/app/components/svg/MiniCaretUp.vue"
import SvgPendingClock from "../../layer/app/components/svg/PendingClock.vue"
import SvgPlus from "../../layer/app/components/svg/Plus.vue"
import SvgSpeaker from "../../layer/app/components/svg/Speaker.vue"
import SvgZekoBigRings from "../../layer/app/components/svg/ZekoBigRings.vue"
import SvgZekoLogo from "../../layer/app/components/svg/ZekoLogo.vue"
import SvgZekoLogoRings from "../../layer/app/components/svg/ZekoLogoRings.vue"
import SvgZekoToken from "../../layer/app/components/svg/ZekoToken.vue"
import SvgNumbersOne from "../../layer/app/components/svg/numbers/One.vue"
import SvgNumbersTwo from "../../layer/app/components/svg/numbers/Two.vue"
import SvgSocialDiscord from "../../layer/app/components/svg/social/Discord.vue"
import SvgSocialGithub from "../../layer/app/components/svg/social/Github.vue"
import SvgSocialTelegram from "../../layer/app/components/svg/social/Telegram.vue"
import SvgSocialX from "../../layer/app/components/svg/social/X.vue"
import { defineComponent, h, onMounted, ref, type App, type PropType } from "vue"

const previewRuntimeConfig = {
	public: {
		links: {
			docs: "https://docs.zeko.io",
			zekoBoom: "https://zeko.io/boom",
			zekoBridge: "https://bridge.zeko.io",
			zekoFaucet: "https://faucet.zeko.io"
		},
		socials: {
			discord: "https://discord.gg/zeko",
			github: "https://github.com/zeko-labs",
			telegram: "https://t.me/zeko_labs",
			twitter: "https://x.com/zekolabs"
		}
	}
}

const previewGlobals = globalThis as typeof globalThis & {
	onMounted: typeof onMounted
	ref: typeof ref
	useRuntimeConfig: () => typeof previewRuntimeConfig
}

previewGlobals.onMounted = onMounted
previewGlobals.ref = ref
previewGlobals.useRuntimeConfig = () => previewRuntimeConfig

const NuxtLink = defineComponent({
	name: "NuxtLink",
	props: {
		to: {
			type: [String, Object] as PropType<string | Record<string, unknown>>,
			required: true
		},
		target: String
	},
	setup(props, { attrs, slots }) {
		return () =>
			h(
				"a",
				{
					...attrs,
					href: typeof props.to === "string" ? props.to : "#",
					target: props.target
				},
				slots.default?.()
			)
	}
})

const ClientOnly = defineComponent({
	name: "ClientOnly",
	setup(_props, { slots }) {
		return () => slots.default?.() ?? null
	}
})

export default function setup(app: App) {
	app.component("ClientOnly", ClientOnly)
	app.component("FooterSocial", FooterSocial)
	app.component("Label", Label)
	app.component("NavigationIndex", NavigationIndex)
	app.component("NavigationItem", NavigationItem)
	app.component("NavigationSound", NavigationSound)
	app.component("NuxtLink", NuxtLink)
	app.component("SvgAuro", SvgAuro)
	app.component("SvgCancelledCircle", SvgCancelledCircle)
	app.component("SvgCaretDown", SvgCaretDown)
	app.component("SvgCheck", SvgCheck)
	app.component("SvgClose", SvgClose)
	app.component("SvgCompletedCircle", SvgCompletedCircle)
	app.component("SvgErrorCircle", SvgErrorCircle)
	app.component("SvgHamburger", SvgHamburger)
	app.component("SvgMGlass", SvgMGlass)
	app.component("SvgMinaLogo", SvgMinaLogo)
	app.component("SvgMinaToken", SvgMinaToken)
	app.component("SvgMiniCaretUp", SvgMiniCaretUp)
	app.component("SvgNumbersOne", SvgNumbersOne)
	app.component("SvgNumbersTwo", SvgNumbersTwo)
	app.component("SvgPendingClock", SvgPendingClock)
	app.component("SvgPlus", SvgPlus)
	app.component("SvgSocialDiscord", SvgSocialDiscord)
	app.component("SvgSocialGithub", SvgSocialGithub)
	app.component("SvgSocialTelegram", SvgSocialTelegram)
	app.component("SvgSocialX", SvgSocialX)
	app.component("SvgSpeaker", SvgSpeaker)
	app.component("SvgZekoBigRings", SvgZekoBigRings)
	app.component("SvgZekoLogo", SvgZekoLogo)
	app.component("SvgZekoLogoRings", SvgZekoLogoRings)
	app.component("SvgZekoToken", SvgZekoToken)
}
