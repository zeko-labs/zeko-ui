import swc from "unplugin-swc"
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        testTimeout: 60_000, // 60 seconds timeout for o1js operations
        hookTimeout: 60_000, // 30 seconds for setup/teardown
        pool: 'forks', // Use process isolation for o1js
    },
    plugins: [swc.vite()]
})
