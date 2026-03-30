// Keep the generated Worker `Env` visible to the local `nitro-cloudflare-dev` type override
// without treating `worker-configuration.d.ts` as a tsconfig `types` library entry. Remove this
// shim once the upstream adapter can bind `event.context.cloudflare.env` to the generated Worker
// env directly.
/// <reference types="./worker-configuration.d.ts" />
