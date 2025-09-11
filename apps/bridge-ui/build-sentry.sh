# This is the CI script to build the project and create a Sentry release with sourcemaps.
# In an ideal world, the Nuxt Module / Vite plugin would work, but it doesn't.
# Make sure that the following variables are set in the environment:
# SENTRY_ORG
# SENTRY_PROJECT
# SENTRY_DSN_PUBLIC
# SENTRY_AUTH_TOKEN

OUTPUT_DIR="./.output/public/_nuxt"

# We set the environment and release based on the branch name.
# WORKERS_CI_BRANCH and WORKERS_CI_COMMIT_SHA are set by Cloudflare Workers CI (https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#default-variables)
if [[ "$WORKERS_CI_BRANCH" == "main" ]]; then
  export SENTRY_ENVIRONMENT="production"
  export SENTRY_RELEASE=$(./node_modules/.bin/sentry-cli releases propose-version)
else 
  # We are in a deploy preview
  # Hash the branch name to create a unique but consistent environment name
  BRANCH_HASH=$(echo -n "$WORKERS_CI_BRANCH" | sha1sum | cut -d ' ' -f 1)
  export SENTRY_ENVIRONMENT="deploy-preview-$BRANCH_HASH"
  export SENTRY_RELEASE="$WORKERS_CI_COMMIT_SHA"
fi

# NUXT
echo "Building RELEASE $SENTRY_RELEASE with DSN $SENTRY_DSN_PUBLIC on environment $SENTRY_ENVIRONMENT"
pnpm build:cf
echo "Build completed."

# SENTRY
echo "Releasing version $SENTRY_RELEASE to Sentry in environment $SENTRY_ENVIRONMENT"
# Create a release
./node_modules/.bin/sentry-cli releases new -p zeko-bridge $SENTRY_RELEASE
# Associate commits with the release
./node_modules/.bin/sentry-cli releases set-commits "$SENTRY_RELEASE" --auto --ignore-missing
# Inject and Upload the sourcemaps
./node_modules/.bin/sentry-cli sourcemaps inject $OUTPUT_DIR
./node_modules/.bin/sentry-cli sourcemaps upload --release=$SENTRY_RELEASE $OUTPUT_DIR
# Create a production deploy
./node_modules/.bin/sentry-cli deploys new --release=$SENTRY_RELEASE -e $SENTRY_ENVIRONMENT

echo "Sentry release process completed."
