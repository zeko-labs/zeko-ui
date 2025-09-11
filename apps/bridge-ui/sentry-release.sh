# This script must be run after building and before deploying on the CI system, currently Cloudflare Build.
# Make sure that the following variables are set in the environment:
# SENTRY_ORG
# SENTRY_PROJECT
# SENTRY_DSN_PUBLIC
# SENTRY_AUTH_TOKEN

OUTPUT_DIR="./.output/public/_nuxt"

# WORKERS_CI_BRANCH and WORKERS_CI_COMMIT_SHA are set by Cloudflare Workers CI (https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#default-variables)
if [[ "$WORKERS_CI_BRANCH" == "main" ]]; then
  ENVIRONMENT="production"
  VERSION=$(./node_modules/.bin/sentry-cli releases propose-version)
else
  ENVIRONMENT="preview-$WORKERS_CI_BRANCH"
  VERSION="$WORKERS_CI_BRANCH-$WORKERS_CI_COMMIT_SHA"
fi

echo "Releasing version $VERSION to Sentry in environment $ENVIRONMENT"

# Create a release
./node_modules/.bin/sentry-cli releases new -p zeko-bridge $VERSION
# Associate commits with the release
./node_modules/.bin/sentry-cli releases set-commits "$VERSION" --auto --ignore-missing
# Upload the sourcemaps
./node_modules/.bin/sentry-cli sourcemaps inject $OUTPUT_DIR
./node_modules/.bin/sentry-cli sourcemaps upload --release=$VERSION $OUTPUT_DIR
# Create a production deploy
./node_modules/.bin/sentry-cli deploys new --release=$VERSION -e $ENVIRONMENT