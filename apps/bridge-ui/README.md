# Bridge UI

This is the Bridge UI application, deployed at `https://bridge.zeko.io`.

The bridge use the `@zeko/layer`.

## Queue Behavior

The bridge UI uses three distinct queue views:

- The main lane processes one non-cancellable operation at a time.
- The main lane ordering is global: non-cancellable deposits first in submission order, then non-cancellable withdrawals in submission order.
- If the current deposit becomes cancellable, it is removed from the main lane immediately and moved to `Cancellable Deposits`.
- Cancellable deposits are skippable and are never shown in the main lane.
- `Deposit Queue` and `Withdrawal Queue` are shown separately whenever they contain queued items.
- When the active main-lane operation completes, the main lane advances to the next item in that global deposit-first, withdrawal-second order.

## Sentry Issues

Build debug flags : `NODE_OPTIONS=--max-old-space-size=8192 NODE_DEBUG=* SENTRY_LOG_LEVEL=debug nuxt build --logLevel verbose`
The following configuration from the nuxt/vite plugin causes the build to fail silently (stuck indefinitely on the last step):

- Enabling any type of sourcemaps upload/processing
- Enable any type of release creation/processing

The nitro preset doesn't seem to be the issue, as switching to `node` preset still causes the same issue.

Manually creating a release with the cli is working, altough the build tends to fail silently sometimes.
The CI script does the following :

- Set environment variables (the CI must pass them)
- Build the App
- Create a sentry release
- Inject the sourcemaps
- Upload the sourcemaps
- Deploys to Sentry
- Deploy to Cloudflare

In an ideal world, the nuxt/sentry module would handle all of this automatically. But it doesn't.

## Sentry CLI

`@sentry/cli` is available as a devDependency. Run it via moon:

```sh
moon bridge-ui:sentry -- <command>
```

### Authentication

Either run `moon bridge-ui:sentry -- login` for interactive auth, or set the `SENTRY_AUTH_TOKEN` environment variable.

### Common Commands

```sh
moon bridge-ui:sentry -- issues list
moon bridge-ui:sentry -- releases list
moon bridge-ui:sentry -- releases files <release> list
```

### IDE Integration

The `@sentry/mcp` server can be used for IDE integration with Sentry data.
