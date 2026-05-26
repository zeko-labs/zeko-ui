# Nuxt 4.4 Readiness Notes

This repo now targets Nuxt 4.4.6 from the shared pnpm catalog. The review covered the release notes from the current 4.1.x baseline through 4.2, 4.3, and 4.4 so the branch is not only a package bump.

## Adopted

- `NuxtAnnouncer` and `useAnnouncer`: the three active Nuxt app roots now mount the announcer, and the faucet flow announces success and error state changes that previously only updated visible text.
- Build profiling: the active Nuxt app Moon configs expose a `profile` task that runs `nuxt build --profile`, giving a consistent entrypoint for investigating Nuxt, Vite, and Rolldown build performance.
- Rolldown Vite: the root pnpm override keeps Vite resolved through `npm:rolldown-vite`, now aligned to the current 7.3.x line. Direct app pins that bypassed the catalog were normalized.

## Deferred

- TypeScript 7 native checking: the native preview provides `tsgo`, but Nuxt typechecking still goes through Nuxt and Vue tooling that consumes the TypeScript API. Replacing `nuxt typecheck` with `tsgo` would drop Vue SFC and Nuxt generated-type coverage, so this branch keeps TypeScript 5.9 with `vue-tsc` 3.3.
- `payloadExtraction: "client"` and ISR/SWR payload extraction: the active apps are configured as client-rendered static/prerendered routes with `ssr: false`, so these features do not currently improve user-facing behavior.
- `createUseFetch` and `createUseAsyncData`: the active Nuxt apps do not have duplicated `useFetch` or `useAsyncData` defaults to consolidate.
- Typed layout props and `setPageLayout` props: current layouts do not pass typed props, so adopting this would be churn without a UI benefit.
- Route groups and route-rule layouts: current page trees are small and do not need structural grouping or route-level layout switching.

## Sources Reviewed

- Nuxt 4.2 release notes: https://nuxt.com/blog/v4-2
- Nuxt 4.3 release notes: https://nuxt.com/blog/v4-3
- Nuxt 4.4 release notes and API docs: https://nuxt.com/blog/v4-4 and https://nuxt.com/docs/4.x/api/components/nuxt-announcer
