FROM docker.io/cloudflare/sandbox:0.7.21

COPY services/bridge-validator/package.json /tmp/bridge-validator-package.json

RUN if command -v apt-get >/dev/null 2>&1; then \
		apt-get update \
		&& apt-get install -y --no-install-recommends ca-certificates git \
		&& rm -rf /var/lib/apt/lists/*; \
	elif command -v apk >/dev/null 2>&1; then \
		apk add --no-cache ca-certificates git; \
	fi

RUN bridge_cli_specifier="$(node -p "const p = require('/tmp/bridge-validator-package.json'); p.bridgeCli.package + '@' + p.bridgeCli.version")" \
	&& npm install --global --omit=dev --no-audit --no-fund "$bridge_cli_specifier" corepack@0.32.0 \
	&& corepack enable \
	&& npm cache clean --force

WORKDIR /workspace
