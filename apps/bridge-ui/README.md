# Bridge UI

This is the Bridge UI application, deployed at `https://bridge.zeko.io`.

The bridge use the `@zeko/layer`.

## Sentry Issues

Build debug flags : `NODE_OPTIONS=--max-old-space-size=8192 NODE_DEBUG=* SENTRY_LOG_LEVEL=debug nuxt build --logLevel verbose`
The following configuration from the nuxt/vite plugin causes the build to fail silently (stuck indefinitely on the last step):

- Enabling any type of sourcemaps upload/processing
- Enable any type of release creation/processing

The nitro preset doesn't seem to be the issue, as switching to `node` preset still causes the same issue.

Manually creating a release with `sentry-cli releases set-commits --auto --ignore-missing <release>` appears to work.
