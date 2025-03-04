import { createSimpleStore } from "~~/helpers/store"

export const useMyCount = createSimpleStore("count", () => {
	const count = ref(0)
	const inc = () => {
		console.log("inc")
		count.value++
	}
	const dec = () => {
		console.log("dec")
		count.value--
	}
	return { count, inc, dec }
})
