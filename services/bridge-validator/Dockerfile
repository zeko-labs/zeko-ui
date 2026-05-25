FROM docker.io/cloudflare/sandbox:0.7.20

ARG BRIDGE_CLI_VERSION=latest

RUN npm install --global --omit=dev --no-audit --no-fund "@zeko-labs/bridge-cli@${BRIDGE_CLI_VERSION}" \
	&& npm cache clean --force

WORKDIR /workspace
