import SvgAuro from "../../layer/app/components/svg/Auro.vue"
import SvgPlus from "../../layer/app/components/svg/Plus.vue"
import type { App } from "vue"

export default function setup(app: App) {
	app.component("SvgAuro", SvgAuro)
	app.component("SvgPlus", SvgPlus)
}
