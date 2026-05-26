FROM docker.io/cloudflare/sandbox:0.7.21

COPY services/bridge-validator/package.json /tmp/bridge-validator-package.json

RUN bridge_cli_specifier="$(node -p "const p = require('/tmp/bridge-validator-package.json'); `${p.bridgeCli.package}@${p.bridgeCli.version}`")" \
	&& npm install --global --omit=dev --no-audit --no-fund "$bridge_cli_specifier" \
	&& npm cache clean --force

WORKDIR /workspace
