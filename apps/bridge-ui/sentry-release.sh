# Assumes you're in a git repository
export SENTRY_AUTH_TOKEN=""
export SENTRY_ORG=zeko-labs
VERSION=$(sentry-cli releases propose-version)
ENVIRONMENT=production
# Create a release
sentry-cli releases new -p zeko-bridge $VERSION
# Associate commits with the release
sentry-cli releases set-commits "$VERSION" --auto --ignore-missing
# Upload the sourcemaps
sentry-cli sourcemaps upload .output/public/_nuxt
# Finalize the release
sentry-cli deploys new --release "$VERSION" -e ENVIRONMENT