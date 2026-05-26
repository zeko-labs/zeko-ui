FROM docker.io/cloudflare/sandbox:0.7.21

RUN npm install --global --omit=dev --no-audit --no-fund "@zeko-labs/bridge-cli@latest" \
	&& npm cache clean --force

WORKDIR /workspace
