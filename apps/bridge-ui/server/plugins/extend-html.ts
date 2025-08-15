import { theme } from "@zeko/design"
const styles = theme

const additionalStyles = `\n--zeko-token-background: ${theme.config.colors.cosmicGold[90].value};
--zeko-token-foreground: ${theme.config.colors.white.value};`
const allStyles = styles.css.string + additionalStyles

export default defineNitroPlugin((nitroApp) => {
	nitroApp.hooks.hook("render:html", (html) => {
		html.bodyAttrs.push(`style="${allStyles}"`)
	})
})
