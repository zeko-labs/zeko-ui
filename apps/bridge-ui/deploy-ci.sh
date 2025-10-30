#!/bin/bash
set -e

# This is the CI script to build the project and create a Sentry release with sourcemaps and deploy it to Cloudflare Workers.
# In an ideal world, the Nuxt Module / Vite plugin would work, but it doesn't.
# Make sure that the following variables are set in the environment:
# SENTRY_ORG
# SENTRY_PROJECT
# SENTRY_DSN_PUBLIC
# SENTRY_AUTH_TOKEN

export SENTRY_LOG_LEVEL="debug"
export PATH="$PATH:$(pwd)/node_modules/.bin:$(pwd)/../../node_modules/.bin"
OUTPUT_DIR="./.output"

# We set the environment and release based on the branch name.
# WORKERS_CI_BRANCH and WORKERS_CI_COMMIT_SHA are set by Cloudflare Workers CI (https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#default-variables)
if [[ "$WORKERS_CI_BRANCH" == "main" ]]; then
  export SENTRY_ENVIRONMENT="production"
  export SENTRY_RELEASE=$(sentry-cli releases propose-version)
else 
  # We are in a deploy preview
  # Hash the branch name to create a unique but consistent environment name
  BRANCH_HASH=$(echo -n "$WORKERS_CI_BRANCH" | sha1sum | cut -d ' ' -f 1)
  export SENTRY_ENVIRONMENT="deploy-preview-$BRANCH_HASH"
  export SENTRY_RELEASE="$WORKERS_CI_COMMIT_SHA"
fi

# NUXT
echo "Building RELEASE $SENTRY_RELEASE with DSN $SENTRY_DSN_PUBLIC on environment $SENTRY_ENVIRONMENT ..."
moon bridge-ui:build
echo "Build completed."

# SENTRY
echo "Releasing version $SENTRY_RELEASE to Sentry in environment $SENTRY_ENVIRONMENT ..."
# Create a release
sentry-cli releases new -p zeko-bridge $SENTRY_RELEASE
# Associate commits with the release
sentry-cli releases set-commits "$SENTRY_RELEASE" --auto --ignore-missing
# Inject and Upload the sourcemaps
sentry-cli sourcemaps inject $OUTPUT_DIR
sentry-cli sourcemaps upload --release=$SENTRY_RELEASE $OUTPUT_DIR
# Create a production deploy
sentry-cli deploys new --release=$SENTRY_RELEASE -e $SENTRY_ENVIRONMENT
echo "Sentry release and sourcemaps done."

if [[ "$WORKERS_CI_BRANCH" == "main" ]]; then
  echo "Deploying Worker to Production ..."
  wrangler deploy
else
  echo "Deploying Worker Preview ..."
  wrangler versions upload
fi
echo "Deployment completed for branch $WORKERS_CI_BRANCH."

# Finalize the release
echo "Finalizing Sentry release $SENTRY_RELEASE ..."
sentry-cli releases finalize $SENTRY_RELEASE
echo "Sentry release $SENTRY_RELEASE finalized."