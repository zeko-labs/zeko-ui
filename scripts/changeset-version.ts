import { $ } from "bun"

console.log("Running changeset version...")
await $`pnpm changeset version`

console.log("Running format fix...")
await $`pnpm exec dprint fmt --allow-no-files`
