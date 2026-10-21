# Launch an Independent Rollup on Ethereum Sepolia

::: warning Independent, operator-owned rollup
This runbook launches a **fresh** Zeko L2 that settles on Ethereum Sepolia. Every key, contract, genesis ledger and configuration file is created by you and belongs to your rollup. It does not connect to, and is not operated by, the Zeko-run network. For the Mina-backed stack, use [Legacy: Launch a Mina-backed Rollup](./launch-rollup.md).
:::

The rollup posts settlement proofs through a **gateway** that speaks the Mina-compatible GraphQL the sequencer expects and submits SP1 proofs to the `ZekoSettlement` and `EthereumZekoBridge` contracts you deploy.

You run: `Sequencer`, `Sequencer signer`, `Prover`, one `DA node` (quorum 1) with its `DA signer`, the `Gateway` (Ethereum settlement, bridge and Mina-compatible L1 façade), `Archive`, `Archive relay`, `Archive node API`, `Actions API`, `Actions indexer`, `Bridge UI`, `Explorer UI`, `PostgreSQL` and `RabbitMQ`. The [service configuration table](#service-configuration) lists the image of each.

The whole stack is one [docker compose](https://docs.docker.com/reference/cli/docker/compose/) file; one-time preparation steps live in the same file under the `bootstrap` profile. Skip to the [Bootstrap process](#bootstrap-process) if you only want the commands.

::: danger `docker compose down -v` erases your rollup
The named volumes hold the DA database, the sequencer ledger, PostgreSQL and the prover state. Removing them deletes state that cannot be regenerated. Never run `docker compose down -v` without a backup; see [Stopping the stack](#stopping-the-stack).
:::

## Prerequisites

> **Matching generations.** The gateway image and the sequencer image must come from matching revisions. The `sepolia-poc` images do; if you rebuild one side, rebuild the other from the same generation.

### System requirements

- Linux `x86_64` host (the published images are `x86_64-linux` only)
- **RAM: 64 GB minimum for the whole stack on one host.** The prover holds about 23 GB resident after compiling the circuits; the genesis export (step 5) and `build-guests` (step 6) each need 16 GB+ on top while the prover runs. The prover compiles the Zeko circuits at every start: minutes on a fast host, hours on a small one; the health check allows 8 h. Running the prover on a separate host is possible (it needs only RabbitMQ and the signer) but is an advanced configuration not covered here; this guide is single-host.
- Disk for PostgreSQL (four databases), the DA database and the sequencer ledger.
- A host that stays awake. Suspend freezes every container; nothing is lost, but settlement stops until the host wakes and the gateway has re-indexed the missed blocks (see Troubleshooting).

### Installed software

- `Docker` with Docker Compose **v2.24 or newer** (`docker compose`; the `env_file` `required: false` attribute used below needs v2.24+)
- `jq`, `sha256sum`, `curl`, `git`, `setfacl` (the `acl` package) on the host for the bootstrap recipes below
- `openssl` for the random tokens in step 1. If it is absent (for example on NixOS), run it ad hoc with `nix shell nixpkgs#openssl`, or replace each `openssl rand -hex 32` with `head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32`

No Foundry, Rust, OCaml or Node toolchain is needed on the host: `forge` and `cast` ship in the `zeko-bootstrap` image and every other binary ships in its service image.

### Tested release

The `sepolia-poc` tag is mutable; this guide expects the image set below. Verify your pulls against it (`docker images --digests 'zekolabs/*:sepolia-poc'`) and keep the table with your deployment record. Source revisions: `zeko-labs/zeko` `b9ee412c3f` (sequencer, DA, archive, archive-node-api, bootstrap roles), `zeko-labs/ethereum-settlement` `15c93d0` (gateway, bridge UI, explorer UI, bootstrap tooling), `zeko-labs/zeko-ui` `d666735e` (Actions API and indexer). Put the zeko revision into `ZEKO_SOURCE_REVISION`.

| Image | Digest |
| --- | --- |
| `zekolabs/zeko-actions-api:sepolia-poc` | `sha256:6c002cb9ad345db2ba71c73f8b57bccd5854660e42eb406deb1501eebb77b26b` |
| `zekolabs/zeko-actions-indexer:sepolia-poc` | `sha256:f4e05eace346ff766805302403c8189c6b9b13db4bcb5f5f05cc02f4c3aca161` |
| `zekolabs/zeko-archive-node-api:sepolia-poc` | `sha256:3ec68e5c69fcd28c4636c10c7a4c51dd480df5093e12858e3ddda1ed90bd2734` |
| `zekolabs/zeko-archive-relay:sepolia-poc` | `sha256:eef12467345b361634d8e84bbc59e66b82a7ac3c6bcd6eea3c242cb9d4aa99f5` |
| `zekolabs/zeko-archive:sepolia-poc` | `sha256:42dcf98b2e6601381e669df334131a8d108acbc1753bc82b48ae4273b1cdadc5` |
| `zekolabs/zeko-bootstrap:sepolia-poc` | `sha256:8c88809da19c3dbb7ea09c05ef02dbd375c1f6dcddea6d7f122c9f3b4af7f0e8` |
| `zekolabs/zeko-bridge-ui:sepolia-poc` | `sha256:1475b70afe67da6a07c7d549aa11dfde03282e56203227e1b6a1685c5ff468ed` |
| `zekolabs/zeko-da:sepolia-poc` | `sha256:d09c969e0e5259dae26ef715eb7537a25e2d705b9ff6d39a61c7dab12f36d539` |
| `zekolabs/zeko-explorer-ui:sepolia-poc` | `sha256:0b240bb34af42d122c117e0e8d853996d9a4d2e24700a7dfcc574b454e4fdbed` |
| `zekolabs/zeko-gateway:sepolia-poc` | `sha256:f1125f3e5c815999fc18aa7e78526b1f1c39bb743bc2036befe5623ee4c7b85c` |
| `zekolabs/zeko:sepolia-poc` | `sha256:fc309de2be12416f3a7bf42785658d64c9ab21f13b595acd89265985d5582c67` |

Supporting images: `postgres:16` and `rabbitmq:4` (major-pinned official images). To remove the manual match entirely, replace each `image:` in the Compose with its `docker.io/zekolabs/<name>@sha256:…` digest from this table.

### Operator-provided external inputs

| Input | Why | Notes |
| --- | --- | --- |
| Sepolia JSON-RPC URL | Gateway `RPC_URL`; `deploy --rpc-url` | Your own provider. Never share one key between unrelated services. |
| Funded Sepolia **admin/deployer** wallet | Deploys the contracts once | You fund it yourself; there is no faucet in this stack. |
| Funded Sepolia **gateway prover** wallet | Submits settlement and bridge transactions | Receives `PROVER_ROLE`. Must differ from admin. |
| **Upgrader** address | `UPGRADER_ROLE` on both proxies | Address only; keep the key offline. |
| Browser wallet for the lifecycle test | Deposits, L2 payments, withdrawals | [MetaMask Flask (Development)](https://chromewebstore.google.com/detail/metamask-flask-developmen/ljfoeinjpaedjfecbmggjgodbgkmjkjk) from the Chrome Web Store with a fresh seed; it installs the Zeko Snap and serves both the Sepolia and the Zeko side. Alternative for the Zeko side: Auro. See Lifecycle examples. |
| Proving mode | See [Proving](#proving) | This guide deploys the **mock verifier**: no SP1 proof is verified on L1. |

### Proving

This demo deploys with the **mock SP1 verifier**: the contracts are deployed with `LOCAL_MOCK_VERIFIER=true` and the gateway runs with `API_LOCAL_MOCK_SUBMIT=true` and `API_UNSAFE_ALLOW_MOCK_ON_SEPOLIA=true`. The gateway executes the SP1 guests locally for their public values and submits them with empty proof bytes, which the mock verifier accepts. This shows the whole bridge and settlement loop without a proving service, but nothing is verified on Ethereum: use it only for disposable test deployments. The Zeko-side prover (`zeko-prover`) is not mock; it compiles the real circuits and proves every commit locally.

**Real proving is out of scope of this demo.** A deployment whose settlements are verified on Ethereum differs only in these knobs:

- Choose the commit validity window before the genesis export (step 5): `ZEKO_ETHEREUM_COMMIT_VALIDITY_PERIOD` on the exporter and `--commit-validity-period` on the sequencer, same value; the settlement tooling default is `2400` slots (8 hours), and the window cannot be changed after the export.
- In `config/deploy.env` (step 7) write `SP1_VERIFIER_ADDRESS=0xb69f2584CBcFf99a58C4e7002E8b89Af54a6f4e2` (the official SP1 v6.1.0 Groth16 verifier on Sepolia) instead of `LOCAL_MOCK_VERIFIER=true`; admin, gateway prover and upgrader must then be three distinct addresses.
- Start the gateway with `API_EXECUTE_ONLY=true`, `API_LOCAL_MOCK_SUBMIT=false` and `API_UNSAFE_ALLOW_MOCK_ON_SEPOLIA=false`, and confirm one job reaches `executed` in `GET /v1/proofs`.
- Then fund a Succinct Prover Network requester, write its key into `secrets/sp1_network_key` in place (so the ACL survives), set `API_EXECUTE_ONLY=false`, `API_REQUIRE_PROOF_APPROVAL=true`, `PROVER_GAS_LIMIT` and `PROVER_MAX_PRICE_PER_PGU`, run `docker compose up -d gateway`, and approve each job through `GET /v1/proofs/:id/quote` and `POST /v1/proofs/:id/approve`.

## Overview

![Sepolia rollup architecture: every service of the Compose file and the direction of each connection](./sepolia-rollup-architecture.png)

Legend: blue arrows are writes, green arrows are reads, red arrows carry traffic both ways; orange boxes are the Zeko core components, black boxes the supporting services. The sequencer reads outer-account state from the gateway, signs through its signer, stores diffs in DA and PostgreSQL, and hands proving work to the prover through RabbitMQ. The gateway is the only service that talks to Sepolia. The archive relay copies DA diffs into the archive database that `archive-node-api` serves to the Actions indexer; the bridge UI reaches the gateway, the sequencer and the Actions API from the browser.

The steps:

- Create the Ethereum admin wallet and predict the deterministic contract addresses.
- Create the Zeko sequencer and DA keys, signer TLS material and the circuit/deploy configuration bound to the predicted bridge address.
- Start the long-lived Zeko services and run the exporter: one real first proof that yields the genesis ledger, the deployment manifest and the public settlement VK.
- Compile the SP1 guests against that VK, compute the program vkeys and deploy the contracts (dry run, then `--broadcast`).
- Start the gateway with the artifacts mounted, then the sequencer, archive stack, Actions services and UIs.

Nothing here builds images. Every image reference is `docker.io/zekolabs/<name>:sepolia-poc`; `docker compose up` pulls them from Docker Hub. If your host has no access to Docker Hub, load the eleven images under that tag yourself before you start.

### Wallets and keys

| Identity | Format | Created by | Used by |
| --- | --- | --- | --- |
| `admin` / deployer | Ethereum `0x…` | `cast wallet new` (bootstrap image) | `predict-address`, `deploy`; owns the PoC factory |
| gateway prover | Ethereum `0x…` | `cast wallet new` | gateway `ETHEREUM_PRIVATE_KEY`; `GATEWAY_PROVER_ADDRESS` at deploy |
| upgrader | Ethereum address | `cast wallet new` in step 1 | `UPGRADER_ADDRESS` at deploy (key stays offline; nothing on the host uses it) |
| Succinct requester | Ethereum `0x…` | your choice | gateway `NETWORK_PRIVATE_KEY` (network proving only) |
| `sequencer` | Zeko Base58 private key (even public key) | `zeko-cli generate-even-key` | sequencer signer `MINA_PRIVATE_KEY`; its public key is the fee payer |
| `da1` | Zeko Base58 private key | `zeko-cli generate-even-key` | DA signer `MINA_PRIVATE_KEY`; public key is `--da-keys` |
| signer auth token | random string | you (`openssl rand -hex 32`) | `ZEKO_SIGNER_AUTH_TOKEN` shared by signers and their clients |
| signer TLS cert/key | X.509 | `zeko-bootstrap-signer-tls` role | signers serve it; clients verify `ZEKO_SIGNER_TLS_HOSTNAME` |
| gateway API key | random string | you | gateway `PROOF_API_KEY`; sequencer `ZEKO_ETHEREUM_GATEWAY_TOKEN` |
| indexer auth token | random string | you | Actions indexer `AUTH_TOKEN` (control endpoints) |
| circuit/deploy config | JSON with fresh private keys | `zeko-bootstrap-generate-config` role | prover, sequencer, exporter |

> **Note:** some variable names keep Mina wording (`MINA_PRIVATE_KEY`, `MINA_SIGNING_NETWORK_ID`, `VIRTUAL_MINA_*`). The signing network id of this stack is `testnet`; the bridge UI refuses anything else.

### Project structure

Everything lives in one persistent workspace **outside any source checkout**:

```
zeko-sepolia/
├── docker-compose.yaml
├── .env                      # 0600; passwords, image tag, public addresses
├── secrets/                  # 0700; one file per secret (Compose file secrets)
├── config/
│   ├── circuits-config.json  # generate-config output (private)
│   ├── deploy-config.json    # generate-config output (private)
│   ├── deploy.env            # DeployPoc.s.sol inputs (public values)
│   ├── virtual-mina-accounts.json
│   ├── bridge-runtime-config.json
│   ├── explorer-runtime-config.json
│   └── postgres-init/        # 0755; first-start database initialization (public SQL only)
├── tls/                      # ca/signer.crt (public), private/signer.key
├── out/export/               # exporter output: first proof, genesis, manifest, VK
├── artifacts/                # settlement-vk.serde.json + guest ELFs (gateway mount)
└── state/                    # bind-mounted writable state of the one-shot roles
```

### Volumes and files

| Volume / directory | Files | Purpose |
| --- | --- | --- |
| `secrets/` | `sequencer_key`, `da1_key`, `signer_auth_token`, `deployer_key`, `gateway_api_key`, `gateway_ethereum_key`, `sp1_network_key`, `indexer_auth_token` | Secret files mounted under `/run/secrets` |
| `config/` | see above | Private Zeko configuration, public deploy inputs, UI runtime configs |
| `tls/` | `ca/signer.crt`, `private/signer.key` | Signer TLS material from `zeko-bootstrap-signer-tls` |
| `out/export/` | `deployment-manifest.json`, `genesis-ledger.json`, `settlement.json`, `settlement-vk.serde.json`, `vk.serde.json`, `proof.serde.json`, … | Export of the first proof; contract genesis comes from it |
| `artifacts/` | `settlement-vk.serde.json`, `settlement-program`, `bridge-program`, `SHA256SUMS`, `provenance.json` | Read by the gateway at startup (`ZEKO_ARTIFACTS_DIR`) |
| `state/` | per one-shot service | Forge workspace and `broadcast/` records, cargo target, exporter sequencer state |
| `postgres_data` | | PostgreSQL: `sequencer`, `gateway`, `archive`, `actions` databases |
| `rabbitmq_data` | | RabbitMQ |
| `da1_data` | | DA node database, including the genesis diff posted by the exporter |
| `sequencer_data` | | Sequencer ledger and checkpoints |
| `prover_state` | | Prover home |
| `gateway_state` | | Gateway home (`/var/lib/zeko-proof-api`, owned by uid `65532` in the image) |
| `archive_relay_data` | | Archive relay database |

> **Note:** Files you must read or hand between steps (secrets, config, export, artifacts) are bind mounts in the workspace. State that only services write lives in named volumes. Back up both.

### Ports

| Service | Container port | Published (on `127.0.0.1`) | Description |
| --- | --- | --- | --- |
| `gateway` | `8080` | `http://localhost:8080` | GraphQL, archive GraphQL, REST, health (browser-facing) |
| `sequencer` | `1923` | `http://localhost:1923` | Sequencer GraphQL (browser-facing, wallets) |
| `actions-api` | `9100` | `http://localhost:9100` | Actions GraphQL (browser-facing) |
| `actions-indexer` | `3600` | `http://localhost:3600` | `/health`, bearer-protected control endpoints |
| `bridge-ui` | `4174` | `http://localhost:4174` | Bridge web app |
| `explorer-ui` | `4175` | `http://localhost:4175` | Explorer web app |
| `archive-node-api` | `8080` | – | L2 archive GraphQL (internal) |
| `archive` | `3086` | – | Archive server port used by the relay |
| `sequencer-signer` / `da1-signer` | `8600` / `8601` | – | Signer services (TLS) |
| `da1` | `8555` / `8558` | – | DA RPC / health |
| `postgres` / `rabbitmq` | `5432` / `5672` | – | Internal only |

Every published port is bound to `127.0.0.1`; use the services in the browser as `http://localhost:<port>`, and put the same URLs into the UI runtime configs and `API_CORS_ALLOWED_ORIGINS`. The sequencer GraphQL endpoint stays open to any origin (`ZEKO_GRAPHQL_CORS_ALLOWED_ORIGINS` unset) because wallet Snaps query it from MetaMask's own origin. Compose service names resolve only between containers.

### Reaching a remote host

When the Docker host is a remote machine, keep the same configuration and bring the ports to your laptop with an SSH tunnel; the browser then sees the `localhost` origins the runtime configs name:

```bash
ssh -N -L 4174:127.0.0.1:4174 -L 4175:127.0.0.1:4175 -L 8080:127.0.0.1:8080 \
       -L 1923:127.0.0.1:1923 -L 9100:127.0.0.1:9100 -L 3600:127.0.0.1:3600 <user>@<host>
```

For public access (not covered here), put a TLS reverse proxy in front of ports `4174`, `4175`, `8080`, `1923` and `9100`, use the public names in both runtime configs and in `API_CORS_ALLOWED_ORIGINS`, and keep `3600` private.

---

## Bootstrap process

### Create the workspace

```bash
umask 077
mkdir -p ~/zeko-sepolia && cd ~/zeko-sepolia
mkdir -p secrets config/postgres-init/actions config/postgres-init/archive tls/ca tls/private \
  out/export artifacts state/zeko-tools state/exporter state/l1 state/bootstrap
chmod 0755 tls/ca artifacts config/postgres-init config/postgres-init/actions config/postgres-init/archive
```

`umask 077` keeps everything you create private; the `postgres-init` directories are read by the container's `postgres` user and stay `0755` / `0644`.

Download the versioned bundle that matches the Tested release, or copy the blocks from this page: [docker-compose.yaml](/sepolia-poc/docker-compose.yaml) and the three `postgres-init` files (<a href="/sepolia-poc/postgres-init/01-databases.sh" target="_blank">01-databases.sh</a>, <a href="/sepolia-poc/postgres-init/archive/create_schema.sql" target="_blank">archive/create_schema.sql</a>, <a href="/sepolia-poc/postgres-init/actions/schema.sql" target="_blank">actions/schema.sql</a>) are byte-identical to the blocks embedded below. Copy `docker-compose.yaml` into the workspace verbatim and create `.env` (mode `0600`). Values carry no quotes and no inline comments, so that the host shell can read them back verbatim:

```bash
cat > .env <<EOF
# Absolute path of this directory; your uid/gid (output of id -u and id -g) for the one-shot roles
ZEKO_WORKSPACE=/home/<you>/zeko-sepolia
ZEKO_UID=$(id -u)
ZEKO_GID=$(id -g)
# zeko commit the images were built from (the exporter records it in the manifest)
ZEKO_SOURCE_REVISION=<zeko commit>
MINA_SIGNING_NETWORK_ID=testnet
ZEKO_POSTGRES_PASSWORD=<random A-Za-z0-9>
ZEKO_RABBITMQ_USER=zeko
ZEKO_RABBITMQ_PASSWORD=<random>
SEPOLIA_RPC_URL=<your provider URL>
PROOF_SYSTEM=groth16
# Mock-verifier demo: the gateway submits empty proof bytes. Real proving: EXECUTE_ONLY=true first, then network credentials.
API_EXECUTE_ONLY=false
API_LOCAL_MOCK_SUBMIT=true
API_UNSAFE_ALLOW_MOCK_ON_SEPOLIA=true
API_REQUIRE_PROOF_APPROVAL=false
PROVER_GAS_LIMIT=
PROVER_MAX_PRICE_PER_PGU=
API_CORS_ALLOWED_ORIGINS=http://localhost:4174,http://localhost:4175
# Filled in by later steps (1: admin; 2: contracts; 3: DA key; 7: block and fork slot; 8: VIRTUAL_MINA_*)
ADMIN_ADDRESS=
SETTLEMENT_CONTRACT_ADDRESS=
BRIDGE_CONTRACT_ADDRESS=
DA1_PUBLIC_KEY=
ETHEREUM_INDEXER_START_BLOCK=
VIRTUAL_MINA_FORK_SLOT=
VIRTUAL_MINA_OUTER_PUBLIC_KEY=
VIRTUAL_MINA_INNER_PUBLIC_KEY=
VIRTUAL_MINA_FEE_PAYER_PUBLIC_KEY=
VIRTUAL_MINA_GENESIS_TIMESTAMP=
EOF
chmod 0600 .env
```

Compose does not export `.env` into your shell. The host commands below read single values with this helper; define it in **every** new shell you open in the workspace:

```bash
envget() { grep -m1 "^$1=" .env | cut -d= -f2-; }
```

Every bootstrap command works with the empty later-phase values; each service refuses to start while a value it needs is still empty.

::: details Click to expand `docker-compose.yaml`
```yaml
name: zeko-sepolia

services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: zeko
      POSTGRES_PASSWORD: ${ZEKO_POSTGRES_PASSWORD:?}
      POSTGRES_DB: sequencer
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./config/postgres-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zeko -d sequencer"]
      interval: 5s
      retries: 60

  rabbitmq:
    image: rabbitmq:4
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: ${ZEKO_RABBITMQ_USER:?}
      RABBITMQ_DEFAULT_PASS: ${ZEKO_RABBITMQ_PASSWORD:?}
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      retries: 30
      start_period: 30s

  # ---------------------------------------------------------------- signers / DA
  sequencer-signer:
    image: docker.io/zekolabs/zeko:sepolia-poc
    tmpfs:
      - /tmp:mode=1777
    restart: unless-stopped
    environment:
      ZEKO_SIGNATURE_KIND: ${MINA_SIGNING_NETWORK_ID}
      MINA_SIGNING_NETWORK_ID: ${MINA_SIGNING_NETWORK_ID}
      ZEKO_SIGNER_TLS_HOSTNAME: zeko-signer
      ZEKO_SIGNER_TLS_CA_FILE: /run/zeko/signer-tls/ca/signer.crt
      ZEKO_BOOTSTRAP_WORKSPACE_HOST: ${ZEKO_WORKSPACE}
      ZEKO_BOOTSTRAP_SOURCE_REVISION: ${ZEKO_SOURCE_REVISION}
    entrypoint:
      - /bin/bash
      - -c
      - |
        set -euo pipefail
        export MINA_PRIVATE_KEY=$$(</run/secrets/sequencer_key)
        export ZEKO_SIGNER_AUTH_TOKEN=$$(</run/secrets/signer_auth_token)
        [[ -n $$MINA_PRIVATE_KEY && -n $$ZEKO_SIGNER_AUTH_TOKEN ]] || { echo "empty secret file" >&2; exit 1; }
        exec /bin/zeko-signer run --host 0.0.0.0 --port 8600 --allow-zkapp-signing \
          --max-fee 10 --max-balance-change 1000000 \
          --tls-cert-file /run/zeko/signer-tls/ca/signer.crt \
          --tls-key-file /run/zeko/signer-tls/private/signer.key
    healthcheck:
      test: ["CMD", "/bin/bash", "-c", "while read -r _ local _ st _; do [[ $$st == 0A && $$local == *:2198 ]] && exit 0; done </proc/net/tcp; exit 1"]
      interval: 10s
      timeout: 5s
      retries: 30
    secrets: [sequencer_key, signer_auth_token]
    volumes:
      - ./tls/ca:/run/zeko/signer-tls/ca:ro
      - ./tls/private:/run/zeko/signer-tls/private:ro

  da1-signer:
    image: docker.io/zekolabs/zeko-da:sepolia-poc
    tmpfs:
      - /tmp:mode=1777
    restart: unless-stopped
    environment:
      ZEKO_SIGNATURE_KIND: ${MINA_SIGNING_NETWORK_ID}
      MINA_SIGNING_NETWORK_ID: ${MINA_SIGNING_NETWORK_ID}
      ZEKO_SIGNER_TLS_HOSTNAME: zeko-signer
      ZEKO_SIGNER_TLS_CA_FILE: /run/zeko/signer-tls/ca/signer.crt
      ZEKO_BOOTSTRAP_WORKSPACE_HOST: ${ZEKO_WORKSPACE}
      ZEKO_BOOTSTRAP_SOURCE_REVISION: ${ZEKO_SOURCE_REVISION}
    entrypoint:
      - /bin/bash
      - -c
      - |
        set -euo pipefail
        export MINA_PRIVATE_KEY=$$(</run/secrets/da1_key)
        export ZEKO_SIGNER_AUTH_TOKEN=$$(</run/secrets/signer_auth_token)
        [[ -n $$MINA_PRIVATE_KEY && -n $$ZEKO_SIGNER_AUTH_TOKEN ]] || { echo "empty secret file" >&2; exit 1; }
        exec /bin/zeko-signer run --host 0.0.0.0 --port 8601 --allow-field-signing \
          --tls-cert-file /run/zeko/signer-tls/ca/signer.crt \
          --tls-key-file /run/zeko/signer-tls/private/signer.key
    healthcheck:
      test: ["CMD", "/bin/bash", "-c", "while read -r _ local _ st _; do [[ $$st == 0A && $$local == *:2199 ]] && exit 0; done </proc/net/tcp; exit 1"]
      interval: 10s
      timeout: 5s
      retries: 30
    secrets: [da1_key, signer_auth_token]
    volumes:
      - ./tls/ca:/run/zeko/signer-tls/ca:ro
      - ./tls/private:/run/zeko/signer-tls/private:ro

  da1:
    image: docker.io/zekolabs/zeko-da:sepolia-poc
    tmpfs:
      - /tmp:mode=1777
    restart: unless-stopped
    environment:
      ZEKO_SIGNATURE_KIND: ${MINA_SIGNING_NETWORK_ID}
      MINA_SIGNING_NETWORK_ID: ${MINA_SIGNING_NETWORK_ID}
      ZEKO_SIGNER_TLS_HOSTNAME: zeko-signer
      ZEKO_SIGNER_TLS_CA_FILE: /run/zeko/signer-tls/ca/signer.crt
      ZEKO_BOOTSTRAP_WORKSPACE_HOST: ${ZEKO_WORKSPACE}
      ZEKO_BOOTSTRAP_SOURCE_REVISION: ${ZEKO_SOURCE_REVISION}
    entrypoint:
      - /bin/bash
      - -c
      - |
        set -euo pipefail
        export ZEKO_SIGNER_AUTH_TOKEN=$$(</run/secrets/signer_auth_token)
        [[ -n $$ZEKO_SIGNER_AUTH_TOKEN ]] || { echo "empty secret file" >&2; exit 1; }
        exec /bin/zeko-da run-node --port 8555 --healthcheck-port 8558 \
          --network-id "$$MINA_SIGNING_NETWORK_ID" \
          --db-dir /var/lib/zeko-da/db --signer da1-signer:8601
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:8558/health"]
      interval: 10s
      timeout: 5s
      retries: 30
    secrets: [signer_auth_token]
    volumes:
      - ./tls/ca:/run/zeko/signer-tls/ca:ro
      - da1_data:/var/lib/zeko-da
    depends_on:
      da1-signer:
        condition: service_healthy

  # ---------------------------------------------------------------- prover
  prover:
    image: docker.io/zekolabs/zeko:sepolia-poc
    tmpfs:
      - /tmp:mode=1777
    restart: unless-stopped
    entrypoint: ["/bin/zeko-prover"]
    command: ["run-server", "--mq-host", "rabbitmq:5672"]
    environment:
      ZEKO_SIGNATURE_KIND: ${MINA_SIGNING_NETWORK_ID}
      MINA_SIGNING_NETWORK_ID: ${MINA_SIGNING_NETWORK_ID}
      ZEKO_SIGNER_TLS_HOSTNAME: zeko-signer
      ZEKO_SIGNER_TLS_CA_FILE: /run/zeko/signer-tls/ca/signer.crt
      ZEKO_BOOTSTRAP_WORKSPACE_HOST: ${ZEKO_WORKSPACE}
      ZEKO_BOOTSTRAP_SOURCE_REVISION: ${ZEKO_SOURCE_REVISION}
      HOME: /var/lib/zeko-prover
      ZEKO_CIRCUITS_CONFIG: /run/zeko/config/circuits-config.json
      ZEKO_DEPLOY_CONFIG: /run/zeko/config/deploy-config.json
      RABBITMQ_USER: ${ZEKO_RABBITMQ_USER}
      RABBITMQ_PASSWORD: ${ZEKO_RABBITMQ_PASSWORD}
    volumes:
      - ./config:/run/zeko/config:ro
      - prover_state:/var/lib/zeko-prover
    # Ready once it holds an ESTABLISHED connection to the broker (5672 = 0x1628);
    # circuit compilation before that takes minutes to hours.
    healthcheck:
      test: ["CMD", "/bin/bash", "-c", "for f in /proc/net/tcp /proc/net/tcp6; do [[ -r $$f ]] || continue; while read -r _ _ rem st _; do [[ $$st == 01 && $$rem == *:1628 ]] && exit 0; done <$$f; done; exit 1"]
      interval: 30s
      timeout: 10s
      retries: 10
      start_period: 8h
    depends_on:
      rabbitmq:
        condition: service_healthy

  # ---------------------------------------------------------------- gateway
  gateway:
    image: docker.io/zekolabs/zeko-gateway:sepolia-poc
    restart: unless-stopped
    entrypoint:
      - /bin/bash
      - -c
      - |
        set -euo pipefail
        export PROOF_API_KEY=$$(</run/secrets/gateway_api_key)
        export ETHEREUM_PRIVATE_KEY=$$(</run/secrets/gateway_ethereum_key)
        [[ -s /run/secrets/sp1_network_key ]] && export NETWORK_PRIVATE_KEY=$$(</run/secrets/sp1_network_key)
        [[ -n $$PROOF_API_KEY && -n $$ETHEREUM_PRIVATE_KEY ]] || { echo "empty secret file" >&2; exit 1; }
        for v in RPC_URL SETTLEMENT_CONTRACT_ADDRESS BRIDGE_CONTRACT_ADDRESS ETHEREUM_INDEXER_START_BLOCK \
                 VIRTUAL_MINA_OUTER_PUBLIC_KEY VIRTUAL_MINA_INNER_PUBLIC_KEY VIRTUAL_MINA_FEE_PAYER_PUBLIC_KEY \
                 VIRTUAL_MINA_GENESIS_TIMESTAMP VIRTUAL_MINA_FORK_SLOT; do
          [[ -n $${!v} ]] || { echo "$$v is empty: fill it in .env (steps 2, 7, 8)" >&2; exit 1; }
        done
        exec /bin/zeko-proof-api
    environment:
      API_BIND: 0.0.0.0:8080
      DATABASE_URL: postgres://zeko:${ZEKO_POSTGRES_PASSWORD}@postgres:5432/gateway
      ARCHIVE_DATABASE_URL: postgres://zeko:${ZEKO_POSTGRES_PASSWORD}@postgres:5432/archive
      RPC_URL: ${SEPOLIA_RPC_URL:-}
      SETTLEMENT_CONTRACT_ADDRESS: ${SETTLEMENT_CONTRACT_ADDRESS:-}
      BRIDGE_CONTRACT_ADDRESS: ${BRIDGE_CONTRACT_ADDRESS:-}
      ETHEREUM_FINALITY_MODE: finalized
      ETHEREUM_INDEXER_START_BLOCK: ${ETHEREUM_INDEXER_START_BLOCK:-}
      PROOF_SYSTEM: ${PROOF_SYSTEM}
      API_EXECUTE_ONLY: ${API_EXECUTE_ONLY}
      API_LOCAL_MOCK_SUBMIT: ${API_LOCAL_MOCK_SUBMIT:-false}
      API_UNSAFE_ALLOW_MOCK_ON_SEPOLIA: ${API_UNSAFE_ALLOW_MOCK_ON_SEPOLIA:-false}
      API_REQUIRE_PROOF_APPROVAL: ${API_REQUIRE_PROOF_APPROVAL}
      PROVER_GAS_LIMIT: ${PROVER_GAS_LIMIT}
      PROVER_MAX_PRICE_PER_PGU: ${PROVER_MAX_PRICE_PER_PGU}
      SEQUENCER_GRAPHQL_URL: http://sequencer:1923/graphql
      VIRTUAL_MINA_ACCOUNTS_PATH: /run/zeko/virtual-mina-accounts.json
      VIRTUAL_MINA_OUTER_PUBLIC_KEY: ${VIRTUAL_MINA_OUTER_PUBLIC_KEY:-}
      VIRTUAL_MINA_INNER_PUBLIC_KEY: ${VIRTUAL_MINA_INNER_PUBLIC_KEY:-}
      VIRTUAL_MINA_FEE_PAYER_PUBLIC_KEY: ${VIRTUAL_MINA_FEE_PAYER_PUBLIC_KEY:-}
      VIRTUAL_MINA_GENESIS_TIMESTAMP: ${VIRTUAL_MINA_GENESIS_TIMESTAMP:-}
      VIRTUAL_MINA_FORK_SLOT: ${VIRTUAL_MINA_FORK_SLOT:-}
      API_CORS_ALLOWED_ORIGINS: ${API_CORS_ALLOWED_ORIGINS}
      # queue bridge proofs itself as soon as the outer writer is free; manual requests lose the race against the settlement cycle
      BRIDGE_AUTO_PROVE_DEPOSITS: "true"
    secrets: [gateway_api_key, gateway_ethereum_key, sp1_network_key]
    volumes:
      - ./artifacts:/var/lib/zeko-proof-api/artifacts:ro
      - ./config/virtual-mina-accounts.json:/run/zeko/virtual-mina-accounts.json:ro
      - gateway_state:/var/lib/zeko-proof-api
    ports:
      - "127.0.0.1:8080:8080"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:8080/health"]
      interval: 10s
      retries: 30
      start_period: 2m
    depends_on:
      postgres:
        condition: service_healthy

  # ---------------------------------------------------------------- sequencer
  sequencer:
    image: docker.io/zekolabs/zeko:sepolia-poc
    tmpfs:
      - /tmp:mode=1777
    restart: on-failure
    # the GraphQL port opens once the sequencer has synced its ledger from the DA genesis diff
    healthcheck:
      test: ["CMD", "/bin/bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/1923"]
      interval: 30s
      timeout: 5s
      retries: 20
      start_period: 1h
    environment:
      ZEKO_SIGNATURE_KIND: ${MINA_SIGNING_NETWORK_ID}
      MINA_SIGNING_NETWORK_ID: ${MINA_SIGNING_NETWORK_ID}
      ZEKO_SIGNER_TLS_HOSTNAME: zeko-signer
      ZEKO_SIGNER_TLS_CA_FILE: /run/zeko/signer-tls/ca/signer.crt
      ZEKO_BOOTSTRAP_WORKSPACE_HOST: ${ZEKO_WORKSPACE}
      ZEKO_BOOTSTRAP_SOURCE_REVISION: ${ZEKO_SOURCE_REVISION}
      ZEKO_PROGRESS_STYLE: percent
      ZEKO_CIRCUITS_CONFIG: /run/zeko/config/circuits-config.json
      RABBITMQ_USER: ${ZEKO_RABBITMQ_USER}
      RABBITMQ_PASSWORD: ${ZEKO_RABBITMQ_PASSWORD}
      DA1_PUBLIC_KEY: ${DA1_PUBLIC_KEY:-}
    entrypoint:
      - /bin/bash
      - -c
      - |
        set -euo pipefail
        export ZEKO_SIGNER_AUTH_TOKEN=$$(</run/secrets/signer_auth_token)
        export ZEKO_ETHEREUM_GATEWAY_TOKEN=$$(</run/secrets/gateway_api_key)
        [[ -n $$ZEKO_SIGNER_AUTH_TOKEN && -n $$ZEKO_ETHEREUM_GATEWAY_TOKEN ]] || { echo "empty secret file" >&2; exit 1; }
        [[ -n $$DA1_PUBLIC_KEY ]] || { echo "DA1_PUBLIC_KEY is empty: fill it in .env (step 3)" >&2; exit 1; }
        exec /bin/zeko-run -p 1923 \
          --l1-uri http://gateway:8080/graphql \
          --archive-uri http://gateway:8080/graphql \
          --signer sequencer-signer:8600 \
          --da-node da1:8555 --da-quorum 1 --da-keys "$$DA1_PUBLIC_KEY" \
          --mq-host rabbitmq:5672 \
          --postgres-uri postgres://zeko:${ZEKO_POSTGRES_PASSWORD}@postgres:5432/sequencer \
          --db-dir /var/lib/zeko-sequencer/db \
          --checkpoints-dir /var/lib/zeko-sequencer/checkpoints \
          --slot-duration 12 --commit-validity-period 100 \
          --commitment-period 300 --max-pool-size 20
    secrets: [signer_auth_token, gateway_api_key]
    volumes:
      - ./config:/run/zeko/config:ro
      - ./tls/ca:/run/zeko/signer-tls/ca:ro
      - sequencer_data:/var/lib/zeko-sequencer
    ports:
      - "127.0.0.1:1923:1923"
    depends_on:
      gateway:
        condition: service_healthy
      sequencer-signer:
        condition: service_healthy
      da1:
        condition: service_healthy
      prover:
        condition: service_healthy
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy

  # ---------------------------------------------------------------- archive stack
  archive:
    image: docker.io/zekolabs/zeko-archive:sepolia-poc
    tmpfs:
      - /tmp:mode=1777
    restart: on-failure
    environment:
      ZEKO_SIGNATURE_KIND: ${MINA_SIGNING_NETWORK_ID}
      MINA_SIGNING_NETWORK_ID: ${MINA_SIGNING_NETWORK_ID}
      ZEKO_SIGNER_TLS_HOSTNAME: zeko-signer
      ZEKO_SIGNER_TLS_CA_FILE: /run/zeko/signer-tls/ca/signer.crt
      ZEKO_BOOTSTRAP_WORKSPACE_HOST: ${ZEKO_WORKSPACE}
      ZEKO_BOOTSTRAP_SOURCE_REVISION: ${ZEKO_SOURCE_REVISION}
    command: [run, --postgres-uri, "postgres://zeko:${ZEKO_POSTGRES_PASSWORD}@postgres:5432/archive", --server-port, "3086"]
    depends_on:
      postgres:
        condition: service_healthy

  archive-relay:
    image: docker.io/zekolabs/zeko-archive-relay:sepolia-poc
    tmpfs:
      - /tmp:mode=1777
    restart: on-failure
    environment:
      ZEKO_SIGNATURE_KIND: ${MINA_SIGNING_NETWORK_ID}
      MINA_SIGNING_NETWORK_ID: ${MINA_SIGNING_NETWORK_ID}
      ZEKO_SIGNER_TLS_HOSTNAME: zeko-signer
      ZEKO_SIGNER_TLS_CA_FILE: /run/zeko/signer-tls/ca/signer.crt
      ZEKO_BOOTSTRAP_WORKSPACE_HOST: ${ZEKO_WORKSPACE}
      ZEKO_BOOTSTRAP_SOURCE_REVISION: ${ZEKO_SOURCE_REVISION}
    command: [--zeko-uri, http://sequencer:1923/graphql, --da-node, da1:8555, --archive-host, archive, --archive-port, "3086", --network-id, "${MINA_SIGNING_NETWORK_ID}", --db-dir, /archive-relay-db, --sync-period, "15"]
    volumes:
      - archive_relay_data:/archive-relay-db
    depends_on:
      archive:
        condition: service_started
      sequencer:
        condition: service_healthy

  archive-node-api:
    image: docker.io/zekolabs/zeko-archive-node-api:sepolia-poc
    tmpfs:
      - /tmp:mode=1777
    restart: unless-stopped
    environment:
      PORT: "8080"
      PG_CONN: postgres://zeko:${ZEKO_POSTGRES_PASSWORD}@postgres:5432/archive
    # graphql-yoga serves GraphQL at the root path and health at /healthcheck
    # (archive-node-api src/server/server.ts).
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:8080/healthcheck"]
      interval: 10s
      retries: 30
    depends_on:
      postgres:
        condition: service_healthy

  # ---------------------------------------------------------------- actions
  actions-api:
    image: docker.io/zekolabs/zeko-actions-api:sepolia-poc
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://zeko:${ZEKO_POSTGRES_PASSWORD}@postgres:5432/actions
      ENVIRONMENT: independent
    ports:
      - "127.0.0.1:9100:9100"
    depends_on:
      postgres:
        condition: service_healthy

  actions-indexer:
    image: docker.io/zekolabs/zeko-actions-indexer:sepolia-poc
    restart: unless-stopped
    entrypoint:
      - /bin/bash
      - -c
      - |
        set -euo pipefail
        export AUTH_TOKEN=$$(</run/secrets/indexer_auth_token)
        [[ -n $$AUTH_TOKEN ]] || { echo "empty secret file" >&2; exit 1; }
        [[ -n $$OUTER_PK && -n $$INNER_PK ]] || { echo "OUTER_PK/INNER_PK are empty: fill VIRTUAL_MINA_*_PUBLIC_KEY in .env (step 8)" >&2; exit 1; }
        exec /bin/node dist/index.js
    environment:
      DATABASE_URL: postgres://zeko:${ZEKO_POSTGRES_PASSWORD}@postgres:5432/actions
      L1_ARCHIVE_URL: http://gateway:8080/graphql
      L2_ARCHIVE_URL: http://archive-node-api:8080/
      OUTER_PK: ${VIRTUAL_MINA_OUTER_PUBLIC_KEY:-}
      INNER_PK: ${VIRTUAL_MINA_INNER_PUBLIC_KEY:-}
      INDEX_OUTER: "true"
      INDEX_INNER: "true"
      INDEX_REGISTRY: "false"
      ENVIRONMENT: independent
    secrets: [indexer_auth_token]
    ports:
      - "127.0.0.1:3600:3600"
    depends_on:
      postgres:
        condition: service_healthy
      gateway:
        condition: service_healthy
      archive-node-api:
        condition: service_healthy

  # ---------------------------------------------------------------- UIs
  bridge-ui:
    image: docker.io/zekolabs/zeko-bridge-ui:sepolia-poc
    restart: unless-stopped
    volumes:
      - ./config/bridge-runtime-config.json:/run/zeko/runtime-config.json:ro
    ports:
      - "127.0.0.1:4174:4174"

  explorer-ui:
    image: docker.io/zekolabs/zeko-explorer-ui:sepolia-poc
    restart: unless-stopped
    volumes:
      - ./config/explorer-runtime-config.json:/run/zeko/runtime-config.json:ro
    ports:
      - "127.0.0.1:4175:4175"

  # ================================================================ bootstrap profile
  # One-shot services: `profiles: ["bootstrap"]`, no restart, run as you
  # (`user: "${ZEKO_UID}:${ZEKO_GID}"`) so that they write into your bind mounts.
  # Two of them are multi-role; the first argument of `docker compose run`
  # selects the tool, the rest are its arguments:
  #   zeko-tools <binary> [args]  zeko-cli, zeko-bootstrap-signer-tls,
  #                               zeko-bootstrap-generate-config (zekolabs/zeko)
  #   bootstrap <role> [args]     cast, predict-address, build-guests, vkey,
  #                               deploy (zekolabs/zeko-bootstrap entrypoint roles)
  # Zeko half (zekolabs/zeko)
  zeko-tools:
    image: docker.io/zekolabs/zeko:sepolia-poc
    tmpfs:
      - /tmp:mode=1777
    profiles: ["bootstrap"]
    restart: "no"
    user: "${ZEKO_UID}:${ZEKO_GID}"
    environment:
      ZEKO_SIGNATURE_KIND: ${MINA_SIGNING_NETWORK_ID}
      MINA_SIGNING_NETWORK_ID: ${MINA_SIGNING_NETWORK_ID}
      ZEKO_SIGNER_TLS_HOSTNAME: zeko-signer
      ZEKO_SIGNER_TLS_CA_FILE: /run/zeko/signer-tls/ca/signer.crt
      ZEKO_BOOTSTRAP_WORKSPACE_HOST: ${ZEKO_WORKSPACE}
      ZEKO_BOOTSTRAP_SOURCE_REVISION: ${ZEKO_SOURCE_REVISION}
      ZEKO_SIGNER_TLS_DAYS: "3650"
    # `run --rm zeko-tools <binary> [args]`: $0 is the binary under /bin, "$@" its arguments
    entrypoint: ["/bin/sh", "-c", "exec \"/bin/$$0\" \"$$@\""]
    volumes:
      - ./tls:/run/zeko/signer-tls
      - ./config:/run/zeko/config
      - ./state/zeko-tools:/var/lib/zeko-bootstrap

  bootstrap-l1:
    image: docker.io/zekolabs/zeko:sepolia-poc
    tmpfs:
      - /tmp:mode=1777
    profiles: ["bootstrap"]
    restart: "no"
    user: "${ZEKO_UID}:${ZEKO_GID}"
    environment:
      ZEKO_SIGNATURE_KIND: ${MINA_SIGNING_NETWORK_ID}
      MINA_SIGNING_NETWORK_ID: ${MINA_SIGNING_NETWORK_ID}
      ZEKO_SIGNER_TLS_HOSTNAME: zeko-signer
      ZEKO_SIGNER_TLS_CA_FILE: /run/zeko/signer-tls/ca/signer.crt
      ZEKO_BOOTSTRAP_WORKSPACE_HOST: ${ZEKO_WORKSPACE}
      ZEKO_BOOTSTRAP_SOURCE_REVISION: ${ZEKO_SOURCE_REVISION}
      ZEKO_TEST_L1_NETWORK_ID: ${MINA_SIGNING_NETWORK_ID}
    entrypoint: ["/bin/zeko-bootstrap-l1"]
    command: ["8080"]
    volumes:
      - ./state/l1:/var/lib/zeko-bootstrap

  exporter:
    image: docker.io/zekolabs/zeko:sepolia-poc
    tmpfs:
      - /tmp:mode=1777
    # zeko-testing-ledger (bootstrap-l1) listens on 127.0.0.1 only, so the exporter shares its network namespace
    network_mode: "service:bootstrap-l1"
    profiles: ["bootstrap"]
    restart: "no"
    user: "${ZEKO_UID}:${ZEKO_GID}"
    # zeko-deployment-export additionally requires the sequencer private key in
    # ZEKO_DEPLOYMENT_SEQUENCER_PRIVATE_KEY and checks it against the signer.
    entrypoint:
      - /bin/bash
      - -c
      - |
        set -euo pipefail
        export ZEKO_DEPLOYMENT_SEQUENCER_PRIVATE_KEY=$$(</run/secrets/sequencer_key)
        [[ -n $$ZEKO_DEPLOYMENT_SEQUENCER_PRIVATE_KEY ]] || { echo "empty secret file" >&2; exit 1; }
        exec /bin/zeko-bootstrap-export
    environment:
      ZEKO_SIGNATURE_KIND: ${MINA_SIGNING_NETWORK_ID}
      MINA_SIGNING_NETWORK_ID: ${MINA_SIGNING_NETWORK_ID}
      ZEKO_SIGNER_TLS_HOSTNAME: zeko-signer
      ZEKO_SIGNER_TLS_CA_FILE: /run/zeko/signer-tls/ca/signer.crt
      ZEKO_BOOTSTRAP_WORKSPACE_HOST: ${ZEKO_WORKSPACE}
      ZEKO_BOOTSTRAP_SOURCE_REVISION: ${ZEKO_SOURCE_REVISION}
      HOME: /var/lib/zeko-bootstrap
      ZEKO_BOOTSTRAP_STATE_DIR: /var/lib/zeko-bootstrap
      ZEKO_CIRCUITS_CONFIG: /run/zeko/config/circuits-config.json
      ZEKO_DEPLOY_CONFIG: /run/zeko/config/deploy-config.json
      ZEKO_BOOTSTRAP_L1: 127.0.0.1:8080
      ZEKO_BOOTSTRAP_POSTGRES_URI: postgres://zeko:${ZEKO_POSTGRES_PASSWORD}@postgres:5432/exporter
      ZEKO_BOOTSTRAP_MQ: rabbitmq:5672
      RABBITMQ_USER: ${ZEKO_RABBITMQ_USER}
      RABBITMQ_PASSWORD: ${ZEKO_RABBITMQ_PASSWORD}
      ZEKO_BOOTSTRAP_SIGNER: sequencer-signer:8600
      ZEKO_BOOTSTRAP_DA_NODES: da1:8555
      ZEKO_BOOTSTRAP_DA_QUORUM: "1"
      # commit validity window in virtual slots; must equal the sequencer's --commit-validity-period (see Step 5)
      ZEKO_ETHEREUM_COMMIT_VALIDITY_PERIOD: "100"
      ZEKO_BOOTSTRAP_OUTPUT_DIR: /out
    secrets: [signer_auth_token, sequencer_key]
    volumes:
      - ./tls/ca:/run/zeko/signer-tls/ca:ro
      - ./config:/run/zeko/config:ro
      - ./out/export:/out
      - ./state/exporter:/var/lib/zeko-bootstrap
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      prover:
        condition: service_healthy
      sequencer-signer:
        condition: service_healthy
      da1:
        condition: service_healthy
      bootstrap-l1:
        condition: service_started

  # Ethereum half (zekolabs/zeko-bootstrap): `run --rm bootstrap <role> [args]`
  # runs `/bin/zeko-bootstrap <role> [args]`; with no arguments the image
  # default `help` runs.
  bootstrap:
    image: docker.io/zekolabs/zeko-bootstrap:sepolia-poc
    profiles: ["bootstrap"]
    restart: "no"
    user: "${ZEKO_UID}:${ZEKO_GID}"
    entrypoint: ["/bin/zeko-bootstrap"]
    # config/deploy.env only exists from step 7 on (Compose v2.24+ attribute)
    env_file:
      - path: ./config/deploy.env
        required: false
    environment:
      ADMIN_ADDRESS: ${ADMIN_ADDRESS:-}
      ZEKO_BOOTSTRAP_DEPLOYER_KEY_FILE: /run/secrets/deployer_key
    secrets: [deployer_key]
    volumes:
      - ./state/bootstrap:/var/lib/zeko-bootstrap
      - ./artifacts:/var/lib/zeko-proof-api/artifacts

secrets:
  sequencer_key:
    file: ./secrets/sequencer_key
  da1_key:
    file: ./secrets/da1_key
  signer_auth_token:
    file: ./secrets/signer_auth_token
  deployer_key:
    file: ./secrets/deployer_key
  gateway_api_key:
    file: ./secrets/gateway_api_key
  gateway_ethereum_key:
    file: ./secrets/gateway_ethereum_key
  sp1_network_key:
    file: ./secrets/sp1_network_key
  indexer_auth_token:
    file: ./secrets/indexer_auth_token

volumes:
  postgres_data:
  rabbitmq_data:
  da1_data:
  sequencer_data:
  prover_state:
  gateway_state:
  archive_relay_data:
```
:::

The bootstrap profile has four one-shot services: `bootstrap` runs the `zeko-bootstrap` image with the role you pass as the first argument (`cast`, `predict-address`, `build-guests`, `vkey`, `deploy`), `zeko-tools` runs the named binary from the `zeko` image, and `bootstrap-l1` and `exporter` have fixed entrypoints.

> **Note:** `$$` is a literal `$` for the in-container shell. The entrypoint shims read the `/run/secrets` files into the environment variables the binaries expect, which keeps secrets out of `docker inspect`.

> **Note:** Secret files keep the host owner and mode. The zeko images run as root and the one-shot roles run as you (`ZEKO_UID`); the gateway and the Actions indexer run as uid `65532`, so step 1 grants that uid read access with an ACL.

### Step 1: Admin wallet and other secrets

Create the three Ethereum wallets and the random tokens; expect the admin, gateway prover and upgrader addresses to be printed.

```bash
cd ~/zeko-sepolia && umask 077
touch secrets/deployer_key    # the bootstrap service mounts this secret for every role; it must exist as a file before the first run
docker compose --profile bootstrap run --rm -T bootstrap cast wallet new --json > secrets/admin-wallet.json
jq -r '.[0].private_key' secrets/admin-wallet.json > secrets/deployer_key
jq -r '.[0].address' secrets/admin-wallet.json          # -> ADMIN_ADDRESS in .env

docker compose --profile bootstrap run --rm -T bootstrap cast wallet new --json > secrets/gateway-wallet.json
jq -r '.[0].private_key' secrets/gateway-wallet.json > secrets/gateway_ethereum_key
jq -r '.[0].address' secrets/gateway-wallet.json        # -> GATEWAY_PROVER_ADDRESS in config/deploy.env

docker compose --profile bootstrap run --rm -T bootstrap cast wallet new --json > secrets/upgrader-wallet.json
jq -r '.[0].address' secrets/upgrader-wallet.json       # -> UPGRADER_ADDRESS in config/deploy.env

openssl rand -hex 32 > secrets/signer_auth_token
openssl rand -hex 32 > secrets/gateway_api_key
openssl rand -hex 32 > secrets/indexer_auth_token
: > secrets/sp1_network_key                              # fill in (edit in place) for network proving
chmod 0600 secrets/*

# The gateway and the Actions indexer run as uid 65532; grant that uid read access
# to exactly the files they consume. Everything stays 0600 for other users.
setfacl -m u:65532:r secrets/gateway_api_key secrets/gateway_ethereum_key \
  secrets/sp1_network_key secrets/indexer_auth_token
getfacl --omit-header secrets/gateway_api_key            # expect: user:65532:r--
```

`-T` disables the pseudo-terminal so that captured output has no terminal line endings. When you later fill `secrets/sp1_network_key`, edit it in place (`>`), which keeps the ACL.

Write the admin address into `ADMIN_ADDRESS` in `.env`. Fund `ADMIN_ADDRESS` (one-time deployment gas) and the gateway prover address (ongoing settlement gas) with Sepolia ETH; the proof-of-work faucet at <https://sepolia-faucet.pk910.de/> covers the deployment in a few hours. The upgrader wallet needs no funds; move `secrets/upgrader-wallet.json` to offline storage once the contracts are deployed.

### Step 2: Predict the contract addresses

The proxy addresses are CREATE2 addresses derived from `ADMIN_ADDRESS`; the bridge address is a circuit input, so it must be known before the Zeko configuration is generated.

```bash
docker compose --profile bootstrap run --rm bootstrap predict-address
```

The role prints `SETTLEMENT_CONTRACT_ADDRESS 0x…` and `BRIDGE_CONTRACT_ADDRESS 0x…` (plus the factory and the local verifier). Copy the two addresses into `.env`, replacing the placeholders below with the printed values:

```bash
sed -i "s#^SETTLEMENT_CONTRACT_ADDRESS=.*#SETTLEMENT_CONTRACT_ADDRESS=<printed settlement address>#; s#^BRIDGE_CONTRACT_ADDRESS=.*#BRIDGE_CONTRACT_ADDRESS=<printed bridge address>#" .env
grep -E '^(SETTLEMENT|BRIDGE)_CONTRACT_ADDRESS=0x' .env     # both lines must show a real 0x address
```

Forge fetches `solc` into `state/bootstrap` on first use.

### Step 3: Zeko keys, signer TLS and circuit configuration

Generate the sequencer and DA keys, the signer TLS material and the circuit configuration bound to the predicted bridge address. Only the public keys are printed.

```bash
umask 077
for name in sequencer da1; do
  docker compose --profile bootstrap run --rm -T zeko-tools zeko-cli generate-even-key > "secrets/$name.keygen"
  awk '/^Private key:/{print $3}' "secrets/$name.keygen" > "secrets/${name}_key"
  awk '/^Public key:/{print $3}' "secrets/$name.keygen" > "secrets/${name}_key.pub"
  rm "secrets/$name.keygen"
done
chmod 0600 secrets/sequencer_key secrets/da1_key
cat secrets/da1_key.pub                                   # -> DA1_PUBLIC_KEY in .env
cat secrets/sequencer_key.pub                             # fee payer; later VIRTUAL_MINA_FEE_PAYER_PUBLIC_KEY

docker compose --profile bootstrap run --rm zeko-tools zeko-bootstrap-signer-tls
docker compose --profile bootstrap run --rm zeko-tools zeko-bootstrap-generate-config "$(envget BRIDGE_CONTRACT_ADDRESS)"
```

Write `DA1_PUBLIC_KEY` into `.env`. The TLS role writes `tls/ca/signer.crt` and `tls/private/signer.key` for the fixed name `zeko-signer`. The config role writes `config/circuits-config.json` and `config/deploy-config.json`; both contain fresh private keys, so back them up offline and never commit them.

### Step 4: Database initialization files

PostgreSQL runs these files once, on first start of an empty data volume; they create the four extra databases and the archive and Actions schemas. Expand each block, copy its content verbatim into the named file, then apply the modes:

```bash
# after creating the three files from the blocks below
chmod 0755 config/postgres-init/01-databases.sh
chmod 0644 config/postgres-init/archive/create_schema.sql config/postgres-init/actions/schema.sql
ls -l config/postgres-init config/postgres-init/archive config/postgres-init/actions
```

::: details Click to expand `config/postgres-init/01-databases.sh`
```bash
#!/bin/bash
set -euo pipefail
for db in gateway archive actions exporter; do
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $db OWNER $POSTGRES_USER"
done
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d archive -f /docker-entrypoint-initdb.d/archive/create_schema.sql
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d actions -f /docker-entrypoint-initdb.d/actions/schema.sql
```
:::

::: details Click to expand `config/postgres-init/archive/create_schema.sql` (archive schema, `zeko` `src/app/archive/create_schema.sql` at the image revision)
```sql
/* the Postgresql schema used by the Mina archive database */

/* Unsigned 64-bit values in OCaml are represented by text values in the database,
   and string values in the type `t`s in the modules below.

   Unsigned 32-bit values are represented by bigint values in the database, and
   int64 values in the `t`s
*/

/* the tables below named `blocks_xxx_commands`, where xxx is `user`, `internal`, or `zkapps`,
   contain columns `block_id` and `xxx_command_id`

   this naming convention must be followed for `find_command_ids_query` in `Replayer.Sql`
   to work properly

   the comment "Blocks command convention" indicates the use of this convention
*/

CREATE TABLE public_keys
( id    serial PRIMARY KEY
, value text   NOT NULL UNIQUE
);

/* for the default token only, owner_public_key_id and owner_token_id are NULL
   for other tokens, those columns are non-NULL
*/
CREATE TABLE tokens
( id                   serial  PRIMARY KEY
, value                text    NOT NULL  UNIQUE
, owner_public_key_id  int               REFERENCES public_keys(id) ON DELETE CASCADE
, owner_token_id       int               REFERENCES tokens(id)
);

CREATE TABLE token_symbols
( id          serial PRIMARY KEY
, value text  NOT NULL
);

CREATE INDEX idx_token_symbols_value ON token_symbols(value);

CREATE TABLE account_identifiers
( id                 serial  PRIMARY KEY
, public_key_id      int     NOT NULL     REFERENCES public_keys(id) ON DELETE CASCADE
, token_id           int     NOT NULL     REFERENCES tokens(id) ON DELETE CASCADE
, UNIQUE (public_key_id,token_id)
);

/* for untimed accounts, the fields other than id, account_identifier_id, and token are 0
*/
CREATE TABLE timing_info
( id                      serial    PRIMARY KEY
, account_identifier_id   int       NOT NULL REFERENCES account_identifiers(id)
, initial_minimum_balance text      NOT NULL
, cliff_time              bigint    NOT NULL
, cliff_amount            text      NOT NULL
, vesting_period          bigint    NOT NULL
, vesting_increment       text      NOT NULL
);

CREATE TABLE snarked_ledger_hashes
( id    serial PRIMARY KEY
, value text   NOT NULL UNIQUE
);

CREATE TYPE user_command_type AS ENUM ('payment', 'delegation');

CREATE TYPE transaction_status AS ENUM ('applied', 'failed');

CREATE TABLE user_commands
( id             serial              PRIMARY KEY
, command_type   user_command_type   NOT NULL
, fee_payer_id   int                 NOT NULL REFERENCES public_keys(id)
, source_id      int                 NOT NULL REFERENCES public_keys(id)
, receiver_id    int                 NOT NULL REFERENCES public_keys(id)
, nonce          bigint              NOT NULL
, amount         text
, fee            text                NOT NULL
, valid_until    bigint
, memo           text                NOT NULL
, hash           text                NOT NULL UNIQUE
);

CREATE TYPE internal_command_type AS ENUM ('fee_transfer_via_coinbase', 'fee_transfer', 'coinbase');

CREATE TABLE internal_commands
( id            serial                PRIMARY KEY
, command_type  internal_command_type NOT NULL
, receiver_id   int                   NOT NULL REFERENCES public_keys(id)
, fee           text                  NOT NULL
, hash          text                  NOT NULL
, UNIQUE (hash,command_type)
);

/* block state hashes mentioned in voting_for fields */
CREATE TABLE voting_for
( id          serial PRIMARY KEY
, value text  NOT NULL
);

CREATE INDEX idx_voting_for_value ON voting_for(value);

/* import supporting Zkapp-related tables */
/* Several of the tables below support the following convention, related
   to NULL values.

   In OCaml, some Zkapp-related types use the constructors Check, which takes a value,
   and Ignore, which is nullary. In columns following the convention, a NULL means Ignore, while
   non-NULL means Check.

   Similarly, in OCaml, there are the constructors Set, which takes a value, and
   Keep, which is nullary. NULL means Keep, and non-NULL means Set.

   The tables that follow this convention have a comment "NULL convention".
*/

/* the string representation of an algebraic field */
CREATE TABLE zkapp_field
( id                       serial           PRIMARY KEY
, field                    text             NOT NULL UNIQUE
);

/* Variable-width arrays of algebraic fields, given as
   id's from zkapp_field

   Postgresql does not allow enforcing that the array elements are
   foreign keys

   The elements of the array are NOT NULL (not enforced by Postgresql)

*/
CREATE TABLE zkapp_field_array
( id                       serial  PRIMARY KEY
, element_ids              int[]   NOT NULL UNIQUE
);

CREATE INDEX idx_zkapp_field_array_element_ids ON zkapp_field_array(element_ids);

/* Fixed-width arrays of algebraic fields, given as id's from
   zkapp_field

   Any element of the array may be NULL, per the NULL convention
*/
CREATE TABLE zkapp_states_nullable
( id                       serial           PRIMARY KEY
, element0                 int              REFERENCES zkapp_field(id)
, element1                 int		    REFERENCES zkapp_field(id)
, element2                 int		    REFERENCES zkapp_field(id)
, element3                 int		    REFERENCES zkapp_field(id)
, element4                 int		    REFERENCES zkapp_field(id)
, element5                 int		    REFERENCES zkapp_field(id)
, element6                 int		    REFERENCES zkapp_field(id)
, element7                 int		    REFERENCES zkapp_field(id)
);

/* like zkapp_states_nullable, but elements are not NULL */
CREATE TABLE zkapp_states
( id                       serial           PRIMARY KEY
, element0                 int              NOT NULL REFERENCES zkapp_field(id)
, element1                 int              NOT NULL REFERENCES zkapp_field(id)
, element2                 int              NOT NULL REFERENCES zkapp_field(id)
, element3                 int              NOT NULL REFERENCES zkapp_field(id)
, element4                 int              NOT NULL REFERENCES zkapp_field(id)
, element5                 int              NOT NULL REFERENCES zkapp_field(id)
, element6                 int              NOT NULL REFERENCES zkapp_field(id)
, element7                 int              NOT NULL REFERENCES zkapp_field(id)
);

/* like zkapp_states, but for action states */
CREATE TABLE zkapp_action_states
( id                       serial           PRIMARY KEY
, element0                 int              NOT NULL REFERENCES zkapp_field(id)
, element1                 int              NOT NULL REFERENCES zkapp_field(id)
, element2                 int              NOT NULL REFERENCES zkapp_field(id)
, element3                 int              NOT NULL REFERENCES zkapp_field(id)
, element4                 int              NOT NULL REFERENCES zkapp_field(id)
);

/* the element_ids are non-NULL, and refer to zkapp_field_array
   they represent a list of arrays of field elements
*/
CREATE TABLE zkapp_events
( id                       serial           PRIMARY KEY
, element_ids              int[]            NOT NULL UNIQUE
);

CREATE INDEX idx_zkapp_events_element_ids ON zkapp_events(element_ids);

/* field elements derived from verification keys */
CREATE TABLE zkapp_verification_key_hashes
( id                                    serial          PRIMARY KEY
, value                                 text            NOT NULL UNIQUE
);

CREATE TABLE zkapp_verification_keys
( id                       serial           PRIMARY KEY
, verification_key         text             NOT NULL UNIQUE
, hash_id                  int              NOT NULL UNIQUE REFERENCES zkapp_verification_key_hashes(id)
);

CREATE TYPE zkapp_auth_required_type AS ENUM ('none', 'either', 'proof', 'signature', 'both', 'impossible');

CREATE TABLE zkapp_permissions
( id                       serial                PRIMARY KEY
, edit_state                       zkapp_auth_required_type    NOT NULL
, send                             zkapp_auth_required_type    NOT NULL
, receive                          zkapp_auth_required_type    NOT NULL
, access                           zkapp_auth_required_type    NOT NULL
, set_delegate                     zkapp_auth_required_type    NOT NULL
, set_permissions                  zkapp_auth_required_type    NOT NULL
, set_verification_key_auth        zkapp_auth_required_type    NOT NULL
, set_verification_key_txn_version int                         NOT NULL
, set_zkapp_uri                    zkapp_auth_required_type    NOT NULL
, edit_action_state                zkapp_auth_required_type    NOT NULL
, set_token_symbol                 zkapp_auth_required_type    NOT NULL
, increment_nonce                  zkapp_auth_required_type    NOT NULL
, set_voting_for                   zkapp_auth_required_type    NOT NULL
, set_timing                       zkapp_auth_required_type    NOT NULL
);

CREATE TABLE zkapp_timing_info
( id                       serial  PRIMARY KEY
, initial_minimum_balance  text    NOT NULL
, cliff_time               bigint  NOT NULL
, cliff_amount             text    NOT NULL
, vesting_period           bigint  NOT NULL
, vesting_increment        text    NOT NULL
);

CREATE TABLE zkapp_uris
( id                 serial  PRIMARY KEY
, value              text    NOT NULL UNIQUE
);

/* NULL convention */
CREATE TABLE zkapp_updates
( id                       serial           PRIMARY KEY
, app_state_id             int              NOT NULL REFERENCES zkapp_states_nullable(id)
, delegate_id              int              REFERENCES public_keys(id)
, verification_key_id      int              REFERENCES zkapp_verification_keys(id)
, permissions_id           int              REFERENCES zkapp_permissions(id)
, zkapp_uri_id             int              REFERENCES zkapp_uris(id)
, token_symbol_id          int              REFERENCES token_symbols(id)
, timing_id                int              REFERENCES zkapp_timing_info(id)
, voting_for_id            int              REFERENCES voting_for(id)
);

CREATE TABLE zkapp_balance_bounds
( id                       serial           PRIMARY KEY
, balance_lower_bound      text             NOT NULL
, balance_upper_bound      text             NOT NULL
);

CREATE TABLE zkapp_nonce_bounds
( id                       serial           PRIMARY KEY
, nonce_lower_bound        bigint           NOT NULL
, nonce_upper_bound        bigint           NOT NULL
);

/* NULL convention */
CREATE TABLE zkapp_account_precondition
( id                       serial     PRIMARY KEY
, balance_id               int                     REFERENCES zkapp_balance_bounds(id)
, nonce_id                 int                     REFERENCES zkapp_nonce_bounds(id)
, receipt_chain_hash       text
, delegate_id              int                     REFERENCES public_keys(id)
, state_id                 int        NOT NULL     REFERENCES zkapp_states_nullable(id)
, action_state_id          int                     REFERENCES zkapp_field(id)
, proved_state             boolean
, is_new                   boolean
, UNIQUE(balance_id, receipt_chain_hash, delegate_id, state_id, action_state_id, proved_state, is_new, nonce_id)
);

CREATE TABLE zkapp_accounts
( id                   serial  PRIMARY KEY
, app_state_id         int     NOT NULL     REFERENCES zkapp_states(id)
, verification_key_id  int                  REFERENCES zkapp_verification_keys(id)
, zkapp_version        bigint  NOT NULL
, action_state_id      int     NOT NULL     REFERENCES zkapp_action_states(id)
, last_action_slot     bigint  NOT NULL
, proved_state         bool    NOT NULL
, zkapp_uri_id         int     NOT NULL     REFERENCES zkapp_uris(id)
);

CREATE TABLE zkapp_token_id_bounds
( id                       serial           PRIMARY KEY
, token_id_lower_bound     text             NOT NULL
, token_id_upper_bound     text             NOT NULL
);

CREATE TABLE zkapp_length_bounds
( id                       serial          PRIMARY KEY
, length_lower_bound       bigint          NOT NULL
, length_upper_bound       bigint          NOT NULL
);

CREATE TABLE zkapp_amount_bounds
( id                       serial          PRIMARY KEY
, amount_lower_bound       text            NOT NULL
, amount_upper_bound       text            NOT NULL
);

CREATE TABLE zkapp_global_slot_bounds
( id                       serial          PRIMARY KEY
, global_slot_lower_bound  bigint          NOT NULL
, global_slot_upper_bound  bigint          NOT NULL
);

/* NULL convention */
CREATE TABLE zkapp_epoch_ledger
( id                       serial          PRIMARY KEY
, hash_id                  int             REFERENCES snarked_ledger_hashes(id)
, total_currency_id        int             REFERENCES zkapp_amount_bounds(id)
);

/* NULL convention */
CREATE TABLE zkapp_epoch_data
( id                       serial          PRIMARY KEY
, epoch_ledger_id          int             REFERENCES zkapp_epoch_ledger(id)
, epoch_seed               text
, start_checkpoint         text
, lock_checkpoint          text
, epoch_length_id          int             REFERENCES zkapp_length_bounds(id)
);

/* NULL convention */
CREATE TABLE zkapp_network_precondition
( id                               serial                         NOT NULL PRIMARY KEY
, snarked_ledger_hash_id           int                            REFERENCES snarked_ledger_hashes(id)
, blockchain_length_id             int                            REFERENCES zkapp_length_bounds(id)
, min_window_density_id            int                            REFERENCES zkapp_length_bounds(id)
/* omitting 'last_vrf_output' for now, it's the unit value in OCaml */
, total_currency_id                int                            REFERENCES zkapp_amount_bounds(id)
, global_slot_since_genesis        int                            REFERENCES zkapp_global_slot_bounds(id)
, staking_epoch_data_id            int                            REFERENCES zkapp_epoch_data(id)
, next_epoch_data_id               int                            REFERENCES zkapp_epoch_data(id)
);

CREATE TABLE zkapp_fee_payer_body
( id                                    serial    PRIMARY KEY
, public_key_id                         int       NOT NULL REFERENCES public_keys(id)
, fee                                   text      NOT NULL
, valid_until                           bigint
, nonce                                 bigint    NOT NULL
);

CREATE TYPE may_use_token AS ENUM ('No', 'ParentsOwnToken', 'InheritFromParent');

CREATE TYPE authorization_kind_type AS ENUM ('None_given', 'Signature', 'Proof');

/* invariant: verification_key_hash_id is not NULL iff authorization_kind = Proof
   in OCaml, the verification key hash is stored with the Proof authorization kind
   here, they're kept separate so we can use an enum type
*/
CREATE TABLE zkapp_account_update_body
( id                                    serial          PRIMARY KEY
, account_identifier_id                 int             NOT NULL  REFERENCES account_identifiers(id)
, update_id                             int             NOT NULL  REFERENCES zkapp_updates(id)
, balance_change                        text            NOT NULL
, increment_nonce                       boolean         NOT NULL
, events_id                             int             NOT NULL  REFERENCES zkapp_events(id)
, actions_id                            int             NOT NULL  REFERENCES zkapp_events(id)
, call_data_id                          int             NOT NULL  REFERENCES zkapp_field(id)
, call_depth                            int             NOT NULL
, zkapp_network_precondition_id         int             NOT NULL  REFERENCES zkapp_network_precondition(id)
, zkapp_account_precondition_id         int             NOT NULL  REFERENCES zkapp_account_precondition(id)
, zkapp_valid_while_precondition_id     int                       REFERENCES zkapp_global_slot_bounds(id)
, use_full_commitment                   boolean         NOT NULL
, implicit_account_creation_fee         boolean         NOT NULL
, may_use_token                         may_use_token  NOT NULL
, authorization_kind                    authorization_kind_type NOT NULL
, verification_key_hash_id              int                       REFERENCES zkapp_verification_key_hashes(id)
);

/* possible future enhancement: add NULLable authorization column for proofs and signatures */
CREATE TABLE zkapp_account_update
( id                       serial                          PRIMARY KEY
, body_id                  int                             NOT NULL REFERENCES zkapp_account_update_body(id)
);

/* a list of of failures for an account update in a zkApp
   the index is the index into the `account_updates`
*/
CREATE TABLE zkapp_account_update_failures
( id       serial    PRIMARY KEY
, index    int       NOT NULL
, failures text[]    NOT NULL
);


/* in OCaml, there's a Fee_payer type, which contains a
   a signature and a reference to the fee payer body. Because
   we don't store a signature, the fee payer here refers
   directly to the fee payer body.

   zkapp_account_updates_ids refers to a list of ids in zkapp_account_update.
   The values in zkapp_account_updates_ids are unenforced foreign keys
   that reference zkapp_account_update_body(id), and not NULL.
*/
CREATE TABLE zkapp_commands
( id                                    serial         PRIMARY KEY
, zkapp_fee_payer_body_id               int            NOT NULL REFERENCES zkapp_fee_payer_body(id)
, zkapp_account_updates_ids             int[]          NOT NULL
, memo                                  text           NOT NULL
, hash                                  text           NOT NULL UNIQUE
);

CREATE TABLE epoch_data
( id               serial PRIMARY KEY
, seed             text   NOT NULL
, ledger_hash_id   int    NOT NULL REFERENCES snarked_ledger_hashes(id)
, total_currency   text   NOT NULL
, start_checkpoint text   NOT NULL
, lock_checkpoint  text   NOT NULL
, epoch_length     bigint NOT NULL
, UNIQUE (seed, ledger_hash_id, total_currency, start_checkpoint, lock_checkpoint, epoch_length)
);

CREATE TABLE protocol_versions
( id               serial PRIMARY KEY
, transaction      int    NOT NULL
, network          int    NOT NULL
, patch            int    NOT NULL
, UNIQUE (transaction,network,patch)
);

CREATE TYPE chain_status_type AS ENUM ('canonical', 'orphaned', 'pending');

/* last_vrf_output is a sequence of hex-digit pairs derived from a bitstring */
CREATE TABLE blocks
( id                           serial   PRIMARY KEY
, state_hash                   text     NOT NULL UNIQUE
, parent_id                    int                      REFERENCES blocks(id)
, parent_hash                  text     NOT NULL
, creator_id                   int      NOT NULL        REFERENCES public_keys(id)
, block_winner_id              int      NOT NULL        REFERENCES public_keys(id)
, last_vrf_output              text     NOT NULL
, snarked_ledger_hash_id       int      NOT NULL        REFERENCES snarked_ledger_hashes(id)
, staking_epoch_data_id        int      NOT NULL        REFERENCES epoch_data(id)
, next_epoch_data_id           int      NOT NULL        REFERENCES epoch_data(id)
, min_window_density           bigint   NOT NULL
, sub_window_densities         bigint[] NOT NULL
, total_currency               text     NOT NULL
, ledger_hash                  text     NOT NULL
, height                       bigint   NOT NULL
, global_slot_since_hard_fork  bigint   NOT NULL
, global_slot_since_genesis    bigint   NOT NULL
, protocol_version_id          int      NOT NULL        REFERENCES protocol_versions(id)
, proposed_protocol_version_id int                      REFERENCES protocol_versions(id)
, timestamp                    text     NOT NULL
, chain_status                 chain_status_type NOT NULL
);

CREATE INDEX idx_blocks_parent_id  ON blocks(parent_id);
CREATE INDEX idx_blocks_creator_id ON blocks(creator_id);
CREATE INDEX idx_blocks_height     ON blocks(height);
CREATE INDEX idx_chain_status      ON blocks(chain_status);

/* accounts accessed in a block, representing the account
   state after all transactions in the block have been executed
*/
CREATE TABLE accounts_accessed
( ledger_index            int     NOT NULL
, block_id                int     NOT NULL  REFERENCES blocks(id)
, account_identifier_id   int     NOT NULL  REFERENCES account_identifiers(id)
, token_symbol_id         int     NOT NULL  REFERENCES token_symbols(id)
, balance                 text    NOT NULL
, nonce                   bigint  NOT NULL
, receipt_chain_hash      text    NOT NULL
, delegate_id             int               REFERENCES public_keys(id)
, voting_for_id           int     NOT NULL  REFERENCES voting_for(id)
, timing_id               int               REFERENCES timing_info(id)
, permissions_id          int     NOT NULL  REFERENCES zkapp_permissions(id)
, zkapp_id                int               REFERENCES zkapp_accounts(id)
, PRIMARY KEY (block_id,account_identifier_id)
);

CREATE INDEX idx_accounts_accessed_block_id ON accounts_accessed(block_id);
CREATE INDEX idx_accounts_accessed_block_account_identifier_id ON accounts_accessed(account_identifier_id);

/* accounts created in a block */
CREATE TABLE accounts_created
( block_id                int     NOT NULL  REFERENCES blocks(id)
, account_identifier_id   int     NOT NULL  REFERENCES account_identifiers(id)
, creation_fee            text    NOT NULL
, PRIMARY KEY (block_id,account_identifier_id)
);

CREATE INDEX idx_accounts_created_block_id ON accounts_created(block_id);
CREATE INDEX idx_accounts_created_block_account_identifier_id ON accounts_created(account_identifier_id);

CREATE TABLE blocks_user_commands
( block_id        int NOT NULL REFERENCES blocks(id) ON DELETE CASCADE
, user_command_id int NOT NULL REFERENCES user_commands(id) ON DELETE CASCADE
, sequence_no     int NOT NULL
, status          transaction_status NOT NULL
, failure_reason  text
, PRIMARY KEY (block_id, user_command_id, sequence_no)
);

CREATE INDEX idx_blocks_user_commands_block_id ON blocks_user_commands(block_id);
CREATE INDEX idx_blocks_user_commands_user_command_id ON blocks_user_commands(user_command_id);
CREATE INDEX idx_blocks_user_commands_sequence_no ON blocks_user_commands(sequence_no);

/* a join table between blocks and internal_commands, with some additional information
   the pair sequence_no, secondary_sequence_no gives the order within all transactions in the block

   Blocks command convention
*/
CREATE TABLE blocks_internal_commands
( block_id              int NOT NULL REFERENCES blocks(id) ON DELETE CASCADE
, internal_command_id   int NOT NULL REFERENCES internal_commands(id) ON DELETE CASCADE
, sequence_no           int NOT NULL
, secondary_sequence_no int NOT NULL
, status                transaction_status NOT NULL
, failure_reason        text
, PRIMARY KEY (block_id, internal_command_id, sequence_no, secondary_sequence_no)
);

CREATE INDEX idx_blocks_internal_commands_block_id ON blocks_internal_commands(block_id);
CREATE INDEX idx_blocks_internal_commands_internal_command_id ON blocks_internal_commands(internal_command_id);
CREATE INDEX idx_blocks_internal_commands_sequence_no ON blocks_internal_commands(sequence_no);
CREATE INDEX idx_blocks_internal_commands_secondary_sequence_no ON blocks_internal_commands(secondary_sequence_no);

/* a join table between blocks and zkapp_commands
   sequence_no gives the order within all transactions in the block

   The `failure_reasons` column is not NULL iff `status` is `failed`. The
   entries in the array are unenforced foreign key references to `zkapp_account_update_failures(id)`.
   Each element of the array refers to the failures for an account update in `account_updates`, and
   is not NULL.

   Blocks command convention
*/

CREATE TABLE blocks_zkapp_commands
( block_id                        int                 NOT NULL REFERENCES blocks(id) ON DELETE CASCADE
, zkapp_command_id                int                 NOT NULL REFERENCES zkapp_commands(id) ON DELETE CASCADE
, sequence_no                     int                 NOT NULL
, status                          transaction_status  NOT NULL
, failure_reasons_ids             int[]
, PRIMARY KEY (block_id, zkapp_command_id, sequence_no)
);

CREATE INDEX idx_blocks_zkapp_commands_block_id ON blocks_zkapp_commands(block_id);
CREATE INDEX idx_blocks_zkapp_commands_zkapp_command_id ON blocks_zkapp_commands(zkapp_command_id);
CREATE INDEX idx_blocks_zkapp_commands_sequence_no ON blocks_zkapp_commands(sequence_no);
```
:::

::: details Click to expand `config/postgres-init/actions/schema.sql` (the seven Actions API drizzle migrations, `zeko-ui` `services/actions/api/drizzle/*/migration.sql`, in order)
```sql
-- ---- 20251124140850_material_victor_mancha/migration.sql
CREATE TABLE "actions" (
	"after_state" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"before_state" text,
	"index" integer NOT NULL,
	"block_height" integer NOT NULL,
	"slot_range_lower" bigint NOT NULL,
	"slot_range_upper" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"marked_as_canonical_at" timestamp with time zone,
	CONSTRAINT "actions_index_unique" UNIQUE("index"),
	CONSTRAINT "actions_before_not_after|check" CHECK ("actions"."before_state" IS NULL OR "actions"."before_state" <> "actions"."after_state")
);
--> statement-breakpoint
CREATE TABLE "commit_actions" (
	"after_state" text PRIMARY KEY NOT NULL,
	"ledger" text NOT NULL,
	"inner_action_state" text NOT NULL,
	"inner_action_state_length" integer NOT NULL,
	"synchronized_outer_action_state" text NOT NULL,
	"synchronized_outer_action_state_length" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "witness_actions" (
	"after_state" text PRIMARY KEY NOT NULL,
	"aux" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_before_state_actions_after_state_fk" FOREIGN KEY ("before_state") REFERENCES "public"."actions"("after_state") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commit_actions" ADD CONSTRAINT "commit_actions_after_state_actions_after_state_fk" FOREIGN KEY ("after_state") REFERENCES "public"."actions"("after_state") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "witness_actions" ADD CONSTRAINT "witness_actions_after_state_actions_after_state_fk" FOREIGN KEY ("after_state") REFERENCES "public"."actions"("after_state") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "before_state|index" ON "actions" USING btree ("before_state");--> statement-breakpoint
CREATE INDEX "after_state|index" ON "actions" USING btree ("after_state");--> statement-breakpoint
CREATE INDEX "index|index" ON "actions" USING btree ("index");--> statement-breakpoint
CREATE INDEX "marked_as_canonical_at|index" ON "actions" USING btree ("marked_as_canonical_at");--> statement-breakpoint
CREATE INDEX "aux|index" ON "witness_actions" USING btree ("aux");

-- ---- 20251124143138_zippy_lady_bullseye/migration.sql
ALTER TABLE "actions" ADD COLUMN "timestamp" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "txn_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "fields" jsonb NOT NULL;

-- ---- 20251127143800_tiresome_firebird/migration.sql
ALTER TABLE "actions" RENAME TO "outer_actions";--> statement-breakpoint
ALTER TABLE "outer_actions" DROP CONSTRAINT "actions_index_unique";--> statement-breakpoint
ALTER TABLE "outer_actions" DROP CONSTRAINT "actions_before_not_after|check";--> statement-breakpoint
ALTER TABLE "outer_actions" DROP CONSTRAINT "actions_before_state_actions_after_state_fk";
--> statement-breakpoint
ALTER TABLE "commit_actions" DROP CONSTRAINT "commit_actions_after_state_actions_after_state_fk";
--> statement-breakpoint
ALTER TABLE "witness_actions" DROP CONSTRAINT "witness_actions_after_state_actions_after_state_fk";
--> statement-breakpoint
ALTER TABLE "outer_actions" ADD CONSTRAINT "outer_actions_before_state_outer_actions_after_state_fk" FOREIGN KEY ("before_state") REFERENCES "public"."outer_actions"("after_state") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commit_actions" ADD CONSTRAINT "commit_actions_after_state_outer_actions_after_state_fk" FOREIGN KEY ("after_state") REFERENCES "public"."outer_actions"("after_state") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "witness_actions" ADD CONSTRAINT "witness_actions_after_state_outer_actions_after_state_fk" FOREIGN KEY ("after_state") REFERENCES "public"."outer_actions"("after_state") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outer_actions" ADD CONSTRAINT "outer_actions_index_unique" UNIQUE("index");--> statement-breakpoint
ALTER TABLE "outer_actions" ADD CONSTRAINT "actions_before_not_after|check" CHECK ("outer_actions"."before_state" IS NULL OR "outer_actions"."before_state" <> "outer_actions"."after_state");

-- ---- 20251127144207_messy_reavers/migration.sql
CREATE TABLE "inner_actions" (
	"after_state" text PRIMARY KEY NOT NULL,
	"before_state" text,
	"index" integer NOT NULL,
	"block_height" integer NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"txn_hash" text NOT NULL,
	"fields" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"marked_as_canonical_at" timestamp with time zone,
	"aux" text NOT NULL,
	CONSTRAINT "inner_actions_index_unique" UNIQUE("index"),
	CONSTRAINT "actions_before_not_after|inner_actions_check" CHECK ("inner_actions"."before_state" IS NULL OR "inner_actions"."before_state" <> "inner_actions"."after_state")
);
--> statement-breakpoint
ALTER TABLE "outer_actions" DROP CONSTRAINT "actions_before_not_after|check";--> statement-breakpoint
DROP INDEX "before_state|index";--> statement-breakpoint
DROP INDEX "after_state|index";--> statement-breakpoint
DROP INDEX "index|index";--> statement-breakpoint
DROP INDEX "marked_as_canonical_at|index";--> statement-breakpoint
DROP INDEX "aux|index";--> statement-breakpoint
ALTER TABLE "inner_actions" ADD CONSTRAINT "inner_actions_before_state_inner_actions_after_state_fk" FOREIGN KEY ("before_state") REFERENCES "public"."inner_actions"("after_state") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "before_state|inner_actions_index" ON "inner_actions" USING btree ("before_state");--> statement-breakpoint
CREATE INDEX "after_state|inner_actions_index" ON "inner_actions" USING btree ("after_state");--> statement-breakpoint
CREATE INDEX "index|inner_actions_index" ON "inner_actions" USING btree ("index");--> statement-breakpoint
CREATE INDEX "marked_as_canonical_at|inner_actions_index" ON "inner_actions" USING btree ("marked_as_canonical_at");--> statement-breakpoint
CREATE INDEX "aux|inner_actions_index" ON "inner_actions" USING btree ("aux");--> statement-breakpoint
CREATE INDEX "before_state|outer_actions_index" ON "outer_actions" USING btree ("before_state");--> statement-breakpoint
CREATE INDEX "after_state|outer_actions_index" ON "outer_actions" USING btree ("after_state");--> statement-breakpoint
CREATE INDEX "index|outer_actions_index" ON "outer_actions" USING btree ("index");--> statement-breakpoint
CREATE INDEX "marked_as_canonical_at|outer_actions_index" ON "outer_actions" USING btree ("marked_as_canonical_at");--> statement-breakpoint
CREATE INDEX "aux|witness_actions_index" ON "witness_actions" USING btree ("aux");--> statement-breakpoint
ALTER TABLE "outer_actions" ADD CONSTRAINT "actions_before_not_after|outer_actions_check" CHECK ("outer_actions"."before_state" IS NULL OR "outer_actions"."before_state" <> "outer_actions"."after_state");

-- ---- 20260716001833_inner_account_update_id/migration.sql
ALTER TABLE "inner_actions" ADD COLUMN "account_update_id" text;--> statement-breakpoint
CREATE INDEX "account_update_id|inner_actions_index" ON "inner_actions" ("account_update_id");

-- ---- 20260724132055_tiny_madame_masque/migration.sql
CREATE TABLE "ethereum_asset_records" (
	"registry_index" integer PRIMARY KEY,
	"schema_version" integer NOT NULL,
	"asset_id" text NOT NULL UNIQUE,
	"ethereum_token_address" text NOT NULL UNIQUE,
	"token_owner_l2" text NOT NULL UNIQUE,
	"token_id_l2" text NOT NULL UNIQUE,
	"decimals" integer NOT NULL,
	"inventory_cap" bigint NOT NULL,
	"mft_standard_vk_id" text NOT NULL,
	"vault_public_key" text NOT NULL,
	"universal_bridge_vk_id" text NOT NULL,
	"registered_root" text NOT NULL,
	"block_height" integer NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"txn_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ethereum_asset_record_shape" CHECK ("registry_index" >= 0 AND "registry_index" < 256 AND "schema_version" = 1 AND "decimals" >= 0 AND "decimals" <= 9 AND "inventory_cap" > 0)
);
--> statement-breakpoint
CREATE TABLE "ethereum_asset_registry_checkpoints" (
	"root" text PRIMARY KEY,
	"count" integer NOT NULL UNIQUE,
	"schema_version" integer NOT NULL,
	"depth" integer NOT NULL,
	"block_height" integer NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"txn_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ethereum_asset_registry_checkpoint_shape" CHECK ("count" > 0 AND "count" <= 256 AND "schema_version" = 1 AND "depth" = 8)
);
--> statement-breakpoint
CREATE TABLE "ethereum_asset_registry_memberships" (
	"root" text,
	"registry_index" integer,
	"path" jsonb NOT NULL,
	CONSTRAINT "ethereum_asset_registry_memberships_pkey" PRIMARY KEY("root","registry_index"),
	CONSTRAINT "ethereum_asset_registry_membership_path_width" CHECK (jsonb_array_length("path") = 8)
);
--> statement-breakpoint
ALTER TABLE "ethereum_asset_records" ADD CONSTRAINT "ethereum_asset_records_Z7f1kcHOCu0r_fkey" FOREIGN KEY ("registered_root") REFERENCES "ethereum_asset_registry_checkpoints"("root") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ethereum_asset_registry_memberships" ADD CONSTRAINT "ethereum_asset_registry_memberships_C4a6TZ6tctwT_fkey" FOREIGN KEY ("root") REFERENCES "ethereum_asset_registry_checkpoints"("root") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ethereum_asset_registry_memberships" ADD CONSTRAINT "ethereum_asset_registry_memberships_dShX3IsSoqDQ_fkey" FOREIGN KEY ("registry_index") REFERENCES "ethereum_asset_records"("registry_index") ON DELETE RESTRICT;

-- ---- 20260728181441_parched_hardball/migration.sql
ALTER TABLE "ethereum_asset_records" ADD COLUMN "finality_status" text DEFAULT 'canonical' NOT NULL;--> statement-breakpoint
ALTER TABLE "ethereum_asset_registry_checkpoints" ADD COLUMN "finality_status" text DEFAULT 'canonical' NOT NULL;--> statement-breakpoint
ALTER TABLE "ethereum_asset_records" ADD CONSTRAINT "ethereum_asset_record_finality" CHECK ("finality_status" IN ('pending', 'canonical'));--> statement-breakpoint
ALTER TABLE "ethereum_asset_registry_checkpoints" ADD CONSTRAINT "ethereum_asset_registry_checkpoint_finality" CHECK ("finality_status" IN ('pending', 'canonical'));
```
:::

Keep the statement order of the Actions block; the `--> statement-breakpoint` markers are SQL comments. If you publish images from a different revision, regenerate both SQL blocks from the sources named in their headings. One database role (`zeko`) owns all databases; per-service roles are an optional hardening step.

### Step 5: Start the long-lived Zeko services and export the genesis

Start the supporting services and the prover, then wait until the prover is healthy. Expect `Compiling circuit` lines until `Compiled circuits in …`.

```bash
docker compose up -d postgres rabbitmq sequencer-signer da1-signer da1 prover
docker compose ps            # wait until prover is healthy (circuit compilation: minutes to hours)
docker compose logs -f prover
```

Then run the export. It produces one real settlement proof, posts the genesis diff to `da1`, and writes into the empty `out/export/`. The Compose sets the commit validity window (`ZEKO_ETHEREUM_COMMIT_VALIDITY_PERIOD` on the exporter, `--commit-validity-period` on the sequencer) to `100` virtual slots of 12 s; it also sets the withdrawal delay and cannot be changed after the export.

```bash
docker compose --profile bootstrap run --rm exporter
docker compose --profile bootstrap stop bootstrap-l1
```

Outputs in `out/export/`:

| File | Content | Consumed by |
| --- | --- | --- |
| `deployment-manifest.json` | `outerPublicKey`, `outerActionState`, `genesisLedgerHash`, `sequencerPublicKey`, `daPublicKeys`, `daQuorum`, `commitValidityPeriod`, `settlementVkSha256`, `zekoSourceRevision` | `.env`, `config/deploy.env` |
| `settlement.json` | the first proof export incl. `proof.binding.stateBefore.fields` (eight outer-state fields), `feePayerPublicKey`, `nonce` | `config/deploy.env`, `virtual-mina-accounts.json` |
| `genesis-ledger.json` | genesis ledger accounts, including the inner account | `VIRTUAL_MINA_INNER_PUBLIC_KEY` |
| `settlement-vk.serde.json` (= `vk.serde.json`) | public settlement VK | `artifacts/`, `SETTLEMENT_VK_HASH` |
| `proof.serde.json`, `public_input_skeleton.json`, `app_statement.json` | proof material | archive with the run |

The DA database (`da1_data`) now holds the genesis diff the rollup continues from. Do not reset it. The exporter refuses to overwrite a non-empty `out/export/`.

### Step 6: Build the SP1 guests and compute the program vkeys

Compile the SP1 guests against the exported VK and compute the two program vkeys. Expect the build to take about 5 minutes on a fast host.

```bash
cp out/export/settlement-vk.serde.json artifacts/settlement-vk.serde.json
chmod 0644 artifacts/settlement-vk.serde.json
docker compose --profile bootstrap run --rm bootstrap build-guests   # offline build, 16 GB+ RAM; about 5 min on a fast host
(cd artifacts && sha256sum -c SHA256SUMS)
chmod 0644 artifacts/*

SETTLEMENT_VKEY=$(docker compose --profile bootstrap run --rm -T bootstrap vkey --program settlement)
BRIDGE_VKEY=$(docker compose --profile bootstrap run --rm -T bootstrap vkey --program bridge)
VK_HASH=0x$(sha256sum artifacts/settlement-vk.serde.json | cut -d' ' -f1)
```

`artifacts/` must stay `0755` with `0644` files; the gateway reads it as uid `65532`. Steps 6 to 8 share shell variables: run them in one shell, or repeat the assignments in a new one.

### Step 7: Deploy the contracts

First derive `FORK_SLOT`, the lower bound of the exported proof's slot range; the contract and the gateway must both use this value.

```bash
MANIFEST=out/export/deployment-manifest.json; SETTLEMENT=out/export/settlement.json
FORK_SLOT=$(( $(jq -er '.proof.binding.actions[0][6]' $SETTLEMENT) ))
SLOT_UPPER=$(( $(jq -er '.proof.binding.actions[0][7]' $SETTLEMENT) ))
if (( FORK_SLOT > 0 && FORK_SLOT <= SLOT_UPPER )); then echo "FORK_SLOT=$FORK_SLOT"; else echo "invalid slot range [$FORK_SLOT, $SLOT_UPPER]: stop here" >&2; unset FORK_SLOT; rm -f config/deploy.env; fi
```

Then write the public values to `config/deploy.env` (mode `0600`). If the check above failed, `FORK_SLOT` is unset, any older `config/deploy.env` is removed, nothing is written and the deploy chain below refuses to run:

```bash
[[ -n ${FORK_SLOT:-} ]] && {
  echo "LOCAL_MOCK_VERIFIER=true"      # demo: deploys LocalSP1Verifier at the predicted LOCAL_SP1_VERIFIER_ADDRESS; accepts empty proofs
  echo "SETTLEMENT_PROGRAM_VKEY=$SETTLEMENT_VKEY"
  echo "BRIDGE_PROGRAM_VKEY=$BRIDGE_VKEY"
  echo "SETTLEMENT_VK_HASH=$VK_HASH"
  echo "INITIAL_OUTER_ACTION_STATE=$(jq -r .outerActionState $MANIFEST)"
  for i in 0 1 2 3 4 5 6 7; do
    echo "INITIAL_OUTER_STATE_$i=$(jq -r ".proof.binding.stateBefore.fields[$i]" $SETTLEMENT)"
  done
  echo "GATEWAY_PROVER_ADDRESS=$(jq -r '.[0].address' secrets/gateway-wallet.json)"
  echo "UPGRADER_ADDRESS=$(jq -r '.[0].address' secrets/upgrader-wallet.json)"
  echo "SLOT_DURATION=12"
  echo "WITHDRAWAL_DELAY_SLOTS=5"
  echo "FORK_SLOT=$FORK_SLOT"
} > config/deploy.env || { echo "deploy.env not written: fix the slot range first" >&2; }
[[ -s config/deploy.env ]] && chmod 0600 config/deploy.env
```

Set `VIRTUAL_MINA_FORK_SLOT` in `.env` to the same `FORK_SLOT` value now.

Deploy inputs:

| Variable | Meaning |
| --- | --- |
| `PRIVATE_KEY` | Deployer key; the `deploy` role reads it from `secrets/deployer_key`. Must belong to `ADMIN_ADDRESS`. |
| `LOCAL_MOCK_VERIFIER` | `true` here: both proxies trust the `LocalSP1Verifier` the script deploys at the predicted `LOCAL_SP1_VERIFIER_ADDRESS` (insecure; demo only). Real proving sets `SP1_VERIFIER_ADDRESS` instead; see [Proving](#proving). |
| `SETTLEMENT_PROGRAM_VKEY`, `BRIDGE_PROGRAM_VKEY` | SP1 program vkeys from step 6 |
| `SETTLEMENT_VK_HASH` | SHA-256 of `settlement-vk.serde.json` (= manifest `settlementVkSha256`) |
| `INITIAL_OUTER_STATE_0…7`, `INITIAL_OUTER_ACTION_STATE` | Genesis outer state from the export |
| `GATEWAY_PROVER_ADDRESS`, `UPGRADER_ADDRESS` | Receive `PROVER_ROLE` and `UPGRADER_ROLE`; kept distinct from the admin |
| `GENESIS_TIMESTAMP`, `SLOT_DURATION`, `FORK_SLOT`, `WITHDRAWAL_DELAY_SLOTS` | Defaults: current block timestamp, `12`, `0`, `5`; `FORK_SLOT` is set to the export's lower slot above |

Dry run first, then broadcast. Expect the printed proxy addresses to match step 2:

```bash
SEPOLIA_RPC_URL=$(envget SEPOLIA_RPC_URL)
[[ -s config/deploy.env ]] || { echo "config/deploy.env is missing; do not deploy" >&2; false; } &&
docker compose --profile bootstrap run --rm bootstrap deploy --rpc-url "$SEPOLIA_RPC_URL" &&            # dry run (simulation only)
docker compose --profile bootstrap run --rm bootstrap deploy --rpc-url "$SEPOLIA_RPC_URL" --broadcast --slow --gas-estimate-multiplier 800
```

`--slow` stops at the first failed transaction; `--gas-estimate-multiplier 800` covers Sepolia pricing contract creation far above Forge's estimate (expect about 3.4M gas for the factory). A failed deployment is simply re-run; the addresses do not change. If the broadcast still fails on the first transaction, compare the chain's estimate with Forge's and raise the multiplier: `cast estimate 0x4e59b44847b379578588920cA78FbF26c0B4956C --from "$(envget ADMIN_ADDRESS)" --rpc-url "$SEPOLIA_RPC_URL" <input of transactions[0] in state/bootstrap/forge-workspace/broadcast/DeployPoc.s.sol/11155111/dry-run/run-latest.json>`. Then set `ETHEREUM_INDEXER_START_BLOCK` in `.env` to the block of the first transaction:

```bash
START_BLOCK=$(( $(jq -r '.receipts[0].blockNumber' state/bootstrap/forge-workspace/broadcast/DeployPoc.s.sol/11155111/run-latest.json) ))
sed -i "s#^ETHEREUM_INDEXER_START_BLOCK=.*#ETHEREUM_INDEXER_START_BLOCK=$START_BLOCK#" .env
grep '^ETHEREUM_INDEXER_START_BLOCK=' .env
```

### Step 8: Gateway inputs: virtual accounts and public keys

The gateway serves a Mina-compatible account view. Seed it from the export (`VIRTUAL_MINA_ACCOUNTS_PATH`):

```bash
to_dec() { docker compose --profile bootstrap run --rm -T bootstrap cast to-dec "$1"; }
OUTER=$(jq -r .outerPublicKey $MANIFEST)
FEE_PAYER=$(jq -r .feePayerPublicKey $SETTLEMENT)
NONCE=$(jq -r .nonce $SETTLEMENT)
ACTION_STATE=$(to_dec "$(jq -r .outerActionState $MANIFEST)")
ZKAPP_STATE=$(for f in $(jq -r '.proof.binding.stateBefore.fields[]' $SETTLEMENT); do to_dec "$f"; done | jq -Rsc 'split("\n")[:-1]')
jq -n --arg outer "$OUTER" --arg feePayer "$FEE_PAYER" --arg nonce "$NONCE" \
  --arg actionState "$ACTION_STATE" --argjson zkappState "$ZKAPP_STATE" \
  '[{publicKey:$outer,tokenId:"1",actionState:[$actionState,"0","0","0","0"],zkappState:$zkappState},
    {publicKey:$feePayer,tokenId:"1",nonce:$nonce}]' > config/virtual-mina-accounts.json
chmod 0644 config/virtual-mina-accounts.json
```

Then fill the remaining `.env` values:

- `VIRTUAL_MINA_OUTER_PUBLIC_KEY` = manifest `outerPublicKey`
- `VIRTUAL_MINA_FEE_PAYER_PUBLIC_KEY` = manifest `sequencerPublicKey` (= `secrets/sequencer_key.pub`)
- `VIRTUAL_MINA_INNER_PUBLIC_KEY` = the inner account public key in `out/export/genesis-ledger.json`: the file is a list of `[index, account]` pairs and the inner account is index `0`, so `jq -r '.[] | select(.[0]==0) | .[1].public_key' out/export/genesis-ledger.json`
- `VIRTUAL_MINA_GENESIS_TIMESTAMP` = the contract's genesis timestamp as RFC 3339:
  ```bash
  SETTLEMENT_CONTRACT_ADDRESS=$(envget SETTLEMENT_CONTRACT_ADDRESS); SEPOLIA_RPC_URL=$(envget SEPOLIA_RPC_URL)
  TS=$(docker compose --profile bootstrap run --rm -T bootstrap cast call "$SETTLEMENT_CONTRACT_ADDRESS" \
    'genesisTimestamp()(uint64)' --rpc-url "$SEPOLIA_RPC_URL" | awk '{print $1}')
  date -u -d "@$TS" +%Y-%m-%dT%H:%M:%SZ
  ```
- `VIRTUAL_MINA_FORK_SLOT` = the `FORK_SLOT` from step 7 (already set there).

### Step 9: UI runtime configuration

Both UIs fetch `/runtime-config.json` at load time. Every URL in these files is used by the browser, so use the `http://localhost:<published port>` addresses from the Ports table, never Compose service names.

```bash
cat > config/bridge-runtime-config.json <<'EOF'
{
  "schemaVersion": 1,
  "gatewayUrl": "http://localhost:8080",
  "sequencerGraphqlUrl": "http://localhost:1923/graphql",
  "zekoArchiveGraphqlUrl": "http://localhost:8080/archive/graphql",
  "actionsApiUrl": "http://localhost:9100/graphql",
  "expectedEthereumChainId": 11155111,
  "minaSigningNetworkId": "testnet",
  "auroNetworkName": "My Zeko Sepolia Rollup",
  "zekoTransactionFeeNanomina": "2500",
  "ethereumExplorerUrl": "https://sepolia.etherscan.io",
  "zekoExplorerUrl": "http://localhost:4175",
  "pollIntervalMs": 5000
}
EOF
cat > config/explorer-runtime-config.json <<'EOF'
{
  "schemaVersion": 1,
  "gatewayUrl": "http://localhost:8080",
  "bridgeUiUrl": "http://localhost:4174",
  "ethereumExplorerUrl": "https://sepolia.etherscan.io",
  "networkName": "My Zeko Sepolia Rollup",
  "pollIntervalMs": 5000
}
EOF
chmod 0644 config/*-runtime-config.json
```

Field rules: `schemaVersion` `1`, `minaSigningNetworkId` `testnet`, `expectedEthereumChainId` `11155111`, `pollIntervalMs` between `1000` and `60000`. `API_CORS_ALLOWED_ORIGINS` in `.env` already names the bridge and explorer origins. Leave the Actions API `ENVIRONMENT` at `independent` (any value other than `sepolia`), so the API reflects the request origin.

### Step 10: Start the stack

Start everything and follow the gateway and sequencer logs.

```bash
docker compose up -d
docker compose ps
docker compose logs -f gateway sequencer
```

Expect the gateway to log `loaded settlement artifacts`, check the program vkeys and the mock verifier against the contracts, and then serve. The sequencer starts once the gateway is healthy, syncs from the DA genesis diff and opens port `1923` within about a minute; `/readyz` answers `ready` once settlement is possible. For about 15 minutes after deploying, the sequencer logs `Commit is paused … programVKey returned no data` until Sepolia finalizes the deployment; harmless. The first commit's job in `GET /v1/proofs` (header `x-api-key: <gateway_api_key>`) should reach `submitted` and the settlement proxy's state should advance on Sepolia.

Finally start the indexing loop (control endpoints need the bearer token):

```bash
curl -X POST -H "Authorization: Bearer $(cat secrets/indexer_auth_token)" http://localhost:3600/start
# "Indexer already running" is fine: the image starts the loop itself; the call is idempotent.
```

## Service configuration

| Service | Image | Configuration inputs | Ports | Storage | Depends on |
| --- | --- | --- | --- | --- | --- |
| `sequencer-signer` | `zeko` | `MINA_PRIVATE_KEY`, `ZEKO_SIGNER_AUTH_TOKEN` (files); `run --host --port --allow-zkapp-signing --max-fee --max-balance-change --tls-cert-file --tls-key-file` | 8600 | `tls/` ro | – |
| `da1-signer` | `zeko-da` | as above with `--allow-field-signing` | 8601 | `tls/` ro | – |
| `da1` | `zeko-da` | `run-node --port --healthcheck-port --network-id --db-dir --signer`; `ZEKO_SIGNER_AUTH_TOKEN`, `ZEKO_SIGNER_TLS_CA_FILE`, `ZEKO_SIGNER_TLS_HOSTNAME` | 8555, 8558 | `da1_data` | `da1-signer` |
| `prover` | `zeko` | `run-server --mq-host`; `ZEKO_CIRCUITS_CONFIG`, `ZEKO_DEPLOY_CONFIG`, `RABBITMQ_USER/PASSWORD` | – | `config/` ro, `prover_state` | `rabbitmq` |
| `sequencer` | `zeko` | `zeko-run -p --l1-uri --archive-uri --signer --da-node --da-quorum --da-keys --mq-host --postgres-uri --db-dir --checkpoints-dir --slot-duration --commit-validity-period --commitment-period --max-pool-size`; `ZEKO_CIRCUITS_CONFIG`, `ZEKO_SIGNATURE_KIND`, `ZEKO_SIGNER_*`, `ZEKO_ETHEREUM_GATEWAY_TOKEN`, `RABBITMQ_*` (`ZEKO_GRAPHQL_CORS_ALLOWED_ORIGINS` deliberately unset: any origin) | 1923 | `sequencer_data`, `sequencer` db | gateway, signer, da1, prover, postgres, rabbitmq |
| `archive` | `zeko-archive` | `run --postgres-uri --server-port` | 3086 | `archive` db | postgres |
| `archive-relay` | `zeko-archive-relay` | `--zeko-uri --da-node --archive-host --archive-port --network-id --db-dir --sync-period` | – | `archive_relay_data` | archive, sequencer |
| `archive-node-api` | `zeko-archive-node-api` | `PG_CONN`, `PORT` | 8080 | – | postgres |
| `gateway` | `zeko-gateway` | `DATABASE_URL`, `ARCHIVE_DATABASE_URL`, `RPC_URL`, `PROOF_API_KEY`, `ETHEREUM_PRIVATE_KEY`, `SETTLEMENT_CONTRACT_ADDRESS`, `BRIDGE_CONTRACT_ADDRESS`, `API_BIND`, `ETHEREUM_FINALITY_MODE`, `ETHEREUM_INDEXER_START_BLOCK`, `PROOF_SYSTEM`, `API_EXECUTE_ONLY`, `API_REQUIRE_PROOF_APPROVAL`, `PROVER_*`, `NETWORK_PRIVATE_KEY`, `SEQUENCER_GRAPHQL_URL`, `VIRTUAL_MINA_*`, `API_CORS_ALLOWED_ORIGINS`, `ZEKO_ARTIFACTS_DIR` | 8080 | `artifacts/` ro, accounts file ro, `gateway` + `archive` db | postgres |
| `actions-api` | `zeko-actions-api` | `DATABASE_URL`, `PORT`, `HOST`, `ENVIRONMENT` | 9100 | `actions` db | postgres |
| `actions-indexer` | `zeko-actions-indexer` | `DATABASE_URL`, `AUTH_TOKEN`, `L1_ARCHIVE_URL`, `L2_ARCHIVE_URL`, `OUTER_PK`, `INNER_PK`, `INDEX_OUTER`, `INDEX_INNER`, `INDEX_REGISTRY`, `REGISTRY_PK`, `L1_FINALITY`, `L2_FINALITY_TIME_H`, `PORT` | 3600 | `actions` db | postgres, gateway, archive-node-api |
| `bridge-ui` / `explorer-ui` | `zeko-bridge-ui` / `zeko-explorer-ui` | runtime config file at `/run/zeko/runtime-config.json` (or `BRIDGE_UI_RUNTIME_CONFIG_FILE` / `EXPLORER_UI_RUNTIME_CONFIG_FILE`), `HOST`, `PORT` | 4174 / 4175 | – | – |

## Connection map

| Consumer | Dependency | Configuration |
| --- | --- | --- |
| Sequencer | PostgreSQL | `--postgres-uri postgres://…@postgres:5432/sequencer` |
| Sequencer | RabbitMQ | `--mq-host rabbitmq:5672`, `RABBITMQ_USER/PASSWORD` |
| Sequencer | Signer, DA | `--signer sequencer-signer:8600`; `--da-node da1:8555 --da-quorum 1 --da-keys <da1 public key>` |
| Sequencer | Gateway | `--l1-uri http://gateway:8080/graphql` (settlement submission with `ZEKO_ETHEREUM_GATEWAY_TOKEN`); `--archive-uri http://gateway:8080/graphql` (outer-account actions such as deposits; `/archive/graphql` is the L2 archive and serves none) |
| Prover | RabbitMQ | `--mq-host rabbitmq:5672`, `RABBITMQ_USER/PASSWORD` |
| DA node | DA signer | `--signer da1-signer:8601`, `ZEKO_SIGNER_AUTH_TOKEN`, TLS CA + hostname |
| Archive | PostgreSQL | `--postgres-uri …/archive` |
| Archive relay | Sequencer, DA, archive | `--zeko-uri http://sequencer:1923/graphql`, `--da-node da1:8555`, `--archive-host archive --archive-port 3086` |
| Archive node API | PostgreSQL | `PG_CONN=postgres://…@postgres:5432/archive` |
| Gateway | PostgreSQL | `DATABASE_URL` → `gateway`; `ARCHIVE_DATABASE_URL` → `archive` (read-only, backs `/archive/graphql` and explorer endpoints) |
| Gateway | Ethereum | `RPC_URL` (operator), contract addresses, `ETHEREUM_PRIVATE_KEY` |
| Gateway | Sequencer | `SEQUENCER_GRAPHQL_URL=http://sequencer:1923/graphql` |
| Actions API | PostgreSQL | `DATABASE_URL` → `actions` |
| Actions indexer | PostgreSQL | `DATABASE_URL` → `actions` |
| Actions indexer | L1 archive | `L1_ARCHIVE_URL=http://gateway:8080/graphql` (Mina-compatible archive GraphQL of the gateway; **not** Ethereum JSON-RPC) |
| Actions indexer | L2 archive | `L2_ARCHIVE_URL=http://archive-node-api:8080/` (GraphQL at the root path) |
| Bridge UI (browser) | Gateway, sequencer, Actions API, explorer | public URLs in `bridge-runtime-config.json` |
| Explorer UI (browser) | Gateway, bridge UI, Etherscan | public URLs in `explorer-runtime-config.json` |

The archive-node-api serves GraphQL at the root path only (no `/graphql` route). It is not published to the host; probe it from inside the Compose network:

```bash
docker compose exec archive-node-api curl -s -X POST -H 'content-type: application/json' \
  --data '{"query":"query { __typename }"}' http://127.0.0.1:8080/
```

## Lifecycle examples

All browser steps happen in the bridge UI (`http://localhost:4174`); it uses only the browser-facing `http://localhost:<port>` endpoints and never receives the gateway API key.

### Deposit ETH to the rollup

1. In the bridge UI connect an Ethereum wallet on Sepolia and a Zeko wallet. Two Zeko wallets work:
   - **MetaMask Flask with the Zeko Snap** (one wallet for both sides). The Snap is not yet allowlisted by MetaMask, so install the developer build [MetaMask Flask (Development)](https://chromewebstore.google.com/detail/metamask-flask-developmen/ljfoeinjpaedjfecbmggjgodbgkmjkjk) from the Chrome Web Store (other browsers: [Install MetaMask Flask](https://docs.metamask.io/snaps/get-started/install-flask/)). Disable the regular MetaMask extension while Flask is active, create a fresh recovery phrase (never a funded production seed), switch to Sepolia and fund it with a little Sepolia ETH. Click **Connect Zeko wallet** → **MetaMask Snap**: Flask installs the Snap, asks to "Contact network", and the derived `B62…` account appears.
   - **Auro**: add a custom network with GraphQL endpoint `http://localhost:1923/graphql` in Auro Settings → Networks, select it, then connect.
2. Deposit ETH to your `B62…` account. The gateway indexes the deposit once Sepolia reports the block `finalized`. Follow it at `GET <gateway>/v1/bridge/deposits/:nonce` (nonces start at `1`): first `canonical deposit not found`, then `status: locked`, `nextAction: requestBridgeProof`.
3. The gateway queues the bridge proof itself (`BRIDGE_AUTO_PROVE_DEPOSITS=true`); to trigger it by hand instead: `curl -X POST -H "x-api-key: $(cat secrets/gateway_api_key)" http://localhost:8080/v1/bridge/deposits/prove` (refused with `a settlement is queued or active` while a settlement is in flight; retry after it finalizes). Expect `status: submitted` within a few minutes; once that Sepolia transaction is finalized and the next commit synchronizes the deposit, the endpoint reports `nextAction: finalizeDepositOnZeko`.
4. Back in the bridge UI, finalize the deposit: sign the `finalizeDeposit` update in your Zeko wallet and the UI submits it to the sequencer. The credit is immediate on L2: `account(publicKey: "B62…") { balance { total } }` on `http://localhost:1923/graphql` shows the amount in nine-decimal units minus the bridge fee. `finalizeDepositOnZeko` is the gateway's terminal state for the deposit.

### Send an L2 transaction

The bridge UI's **Wallet** tab sends native ETH (and bridged tokens) on Zeko with the connected Zeko wallet. With Auro directly, add your rollup as a custom network (name = `auroNetworkName`, GraphQL endpoint = `sequencerGraphqlUrl`) and send a payment. Zeko uses 9 decimals: 1 ETH = `1000000000` L2 base units. Query the sequencer directly:

```bash
curl -s -H 'content-type: application/json' --data '{"query":"query { __typename }"}' http://localhost:1923/graphql
```

### Observe settlement

Every `--commitment-period` with something to commit, the sequencer posts the diff to DA, the prover proves the commit (about 20 s), and the gateway executes the settlement guest and submits to Sepolia within minutes. Each settlement emits a `Commit` action that the next commit absorbs, so expect one settlement per Sepolia finality window (about 20 minutes, about 931k gas each) even with no user traffic; keep the gateway wallet funded for that rate. Watch the jobs with `curl -H "x-api-key: …" http://localhost:8080/v1/proofs`; the explorer UI lists settlements, and the transactions are on Sepolia Etherscan under the settlement proxy.

### Withdraw to Ethereum

1. In the bridge UI request a withdrawal from Zeko to your `0x…` address; the UI prepares the witness through the Actions API and you sign the L2 transaction.
2. A later settlement binds the withdrawal into the V2 Keccak root. `GET <gateway>/v1/bridge/withdrawals?recipient=0x…` returns the Merkle path and delay status.
3. The withdrawal becomes `claimable` at the commit's upper slot plus `WITHDRAWAL_DELAY_SLOTS`: with the values in this guide about 21 minutes (105 virtual slots) after its settlement. `GET …/v1/bridge/withdrawals` shows `claimableSlot`. Then claim in the bridge UI with your Ethereum wallet.

## Demo completion checklist

The mock-verifier demonstration is complete when all four hold; it does not establish real Ethereum proof verification.

- [ ] Deposit credited on L2: `account(publicKey: "<your B62…>") { balance { total } }` on `http://localhost:1923/graphql` shows the deposit minus the bridge fee.
- [ ] L2 payment observed: the recipient's balance on the same query increased and the explorer UI (`http://localhost:4175`) lists the L2 block.
- [ ] Settlement recorded on Sepolia: `GET http://localhost:8080/v1/explorer/settlements` lists at least one `confirmed` item and its `ethereumTransactionHash` succeeds on Sepolia Etherscan.
- [ ] Withdrawal claimed on Ethereum: `GET http://localhost:8080/v1/bridge/withdrawals?recipient=0x…` reports `processed` and the claim transaction succeeded on Etherscan.

## Troubleshooting

```bash
docker compose ps
docker compose logs -f                       # everything
docker compose logs -f prover                # "Compiling circuit" lines until "Compiled circuits in …"
docker compose logs -f gateway sequencer
curl -s http://localhost:8080/health          # gateway
curl -s http://localhost:9100/health          # actions-api (reports database status)
curl -s http://localhost:3600/health          # actions-indexer
curl -s -H "Authorization: Bearer $(cat secrets/indexer_auth_token)" http://localhost:3600/status
```

| Symptom | What to do |
| --- | --- |
| any `zeko*` image: `Unix_error "Permission denied" mkdir "((dirname /tmp) …"` | The zeko images ship no `/tmp`. Keep the `tmpfs: /tmp:mode=1777` mount on every zeko service when you edit the Compose file. |
| `deploy --broadcast`: `Transaction Failure: 0x…` on the first transaction (`contract creation code storage out of gas`) | Forge's gas estimate is below live Sepolia costs. Re-run the broadcast with `--slow --gas-estimate-multiplier 800`; if it still fails, raise the multiplier. The addresses are deterministic, so a re-run is safe. |
| `sequencer` loops on `Failed to send zkapp command: Graphql_error: RESERVATION_REQUIRED` | Gateway and sequencer images are from different generations. Use the Tested release set (or rebuild both from one revision) and recreate the sequencer with an empty `sequencer` database and volume. |
| `sequencer` exits once with `duplicate key value violates unique constraint "da_diff_target_ledger_hash_key"` | The exporter and the sequencer shared a database. Point `ZEKO_BOOTSTRAP_POSTGRES_URI` at the `exporter` database (as in the Compose) or start the sequencer with an empty `sequencer` database. |
| `archive-node-api` logs `TypeError: Cannot read properties of undefined (reading 'height')` and `actions-indexer` reports `inner iteration failed: [GraphQL] Unexpected error` | The archive has no block yet. Harmless until the first L2 transaction produces a block; the indexer retries every interval. |
| `sequencer` logs `All new actions: 0` forever although a deposit is `bridgeProven` | `--archive-uri` must point at the gateway's `/graphql` (outer-account actions), not `/archive/graphql` (the L2 archive). Fix the Compose and recreate the sequencer. |
| sequencer: `Commit is paused: Ethereum gateway /v1/settlement-reservations: HTTP 503 … contract call to \`programVKey\` returned no data ("0x")` right after the first start | The gateway reads the contracts at Sepolia's finalized block and the deployment is not finalized yet. Clears by itself within 10 to 15 minutes; the sequencer retries. |
| After the host slept: gateway `retrying transient Ethereum RPC read failure` bursts, sequencer `Commit is paused: … timed out`, a job stays `submitted`, `/readyz` says `waiting_for_outer_writer` | Nothing is broken. The gateway re-indexes every missed Sepolia block (about 3 blocks/s), then confirms the pending job and releases the outer writer; the sequencer retries every 15 s. Do not restart anything; if you must, restart the gateway only. |
| `exporter` prints nothing and never exits | It is waiting for `bootstrap-l1` on `127.0.0.1:8080` (`docker top <exporter container>` shows the `sleep 1` loop). Keep `network_mode: "service:bootstrap-l1"` on the exporter as in the Compose, then re-run. |
| `prover` unhealthy for a long time | Circuit compilation; `start_period` is 8 h. Watch the `Compiling circuit` lines and check memory. |
| gateway exits naming the artifacts directory | Re-run step 6 so `artifacts/` holds `settlement-program`, `bridge-program`, `settlement-vk.serde.json` and `SHA256SUMS`, then `chmod 0755 artifacts && chmod 0644 artifacts/*` and `docker compose up -d gateway` |
| gateway exits on program vkey mismatch | Guests/VK differ from what the contracts were initialized with: redo steps 6 and 7 consistently |
| gateway warns `Zeko archive schema is not ready` | Expected until the archive has written its first L2 block; no action |
| exporter: `refusing to export into non-empty /out` | Empty `out/export/` yourself to re-run |
| exporter: `ZEKO_DEPLOYMENT_SEQUENCER_PRIVATE_KEY does not match the signer endpoint` | `secrets/sequencer_key` and the key `sequencer-signer` started with differ. Restore the original file from your backup (its public key is `secrets/sequencer_key.pub`), then `docker compose up -d sequencer-signer` and re-run the exporter. Do not regenerate keys: `config/` and the genesis depend on them. If the original key cannot be recovered, abandon this disposable demo deployment and bootstrap a new instance in a fresh workspace, starting at step 1 with a new deployer wallet; preserve the old workspace for investigation |
| `da1` exits at start | Bring `da1-signer` to healthy first (`docker compose ps`; check the `tls/` mounts), then `docker compose up -d da1` |
| indexer GraphQL errors | Check `L1_ARCHIVE_URL` (gateway `/graphql`) and `L2_ARCHIVE_URL` (archive-node-api root path; probe in [Connection map](#connection-map)) |
| gateway or indexer logs `Permission denied` on `/run/secrets/…` | The ACL from step 1 is missing (`getfacl secrets/<file>` must list `user:65532:r--`); re-run the `setfacl` line |
| postgres init fails with `Permission denied` or `No such file` | `config/postgres-init` and its subdirectories must be `0755` and the SQL files `0644`; re-run step 4 on an empty `postgres_data` volume |
| bridge UI shows a config error | Fix `config/bridge-runtime-config.json` (`schemaVersion` 1, `expectedEthereumChainId` 11155111, `minaSigningNetworkId` `testnet`, `http://localhost:<port>` URLs), check the mount in the Compose, then `docker compose up -d bridge-ui` |
| bridge UI requests to `:1923` fail CORS while host `curl` succeeds | Check with `curl -i -X OPTIONS -H 'Origin: http://localhost:4174' -H 'Access-Control-Request-Method: POST' http://localhost:1923/graphql`. A `404` means the `zeko` image lacks sequencer CORS support; use the Tested release image. A `204` without `Access-Control-Allow-Origin` means `ZEKO_GRAPHQL_CORS_ALLOWED_ORIGINS` is set; remove it and recreate the sequencer. |
| "Connect Zeko wallet" with the MetaMask Snap fails with `Failed to fetch` after the "Contact network" approval | The Snap calls the sequencer from MetaMask's own origin. Leave `ZEKO_GRAPHQL_CORS_ALLOWED_ORIGINS` unset (default `*`) and recreate the sequencer. |

## Stopping the stack

Stop or remove containers **without** touching volumes:

```bash
docker compose stop          # keep containers
docker compose down          # remove containers and network, keep volumes
```

### Capacity, monitoring and recovery

Sizing expectations for one host:

| Item | Expect |
| --- | --- |
| Prover resident memory | 23 GB after circuit compilation, constant |
| Peak host memory | export and `build-guests` each add 16 GB+ on top of the prover |
| CPU | load 4 to 5 on 16 cores while proving a commit (about 20 s), near idle otherwise |
| `postgres_data` | a few hundred MB; grows steadily, because the gateway indexes every Sepolia block from the start block |
| `da1_data`, `sequencer_data`, `archive_relay_data` | under 1 MB each for the first L2 blocks |
| `state/` | about 340 MB, almost all the Forge workspace of the bootstrap roles |
| `artifacts/` | 13 MB |

What to watch: `docker compose ps` health columns; the sequencer's `GET http://localhost:1923/readyz` (`ready`, or the blocking reason); the gateway's `GET /health` and `GET /v1/proofs` (a job stuck in `submitted` is waiting for Sepolia finality); the indexer's `GET http://localhost:3600/status` (`consecutiveErrors` should return to `0`); the gateway wallet's Sepolia balance; and the `postgres_data` volume. There is no metrics endpoint.

Losing `da1_data` loses the rollup. To restore, run the backup below in reverse on a host with the same image digests: stop the stack, `tar xzf` each archive into a fresh named volume with the same name, restore the bind-mounted directories with their modes and ACLs, start the stack. Containers survive a host reboot; a host that suspends pauses the rollup (see Troubleshooting).

### Backup and export

Back up, offline and encrypted: `secrets/`, `config/`, `tls/`, `out/export/`, `artifacts/`, `state/bootstrap/forge-workspace/broadcast/`, `state/exporter/`, and all seven named volumes. `rabbitmq_data`, `prover_state` and `gateway_state` could be rebuilt, but restoring them avoids hours of recompilation:

```bash
docker compose stop
for v in postgres_data rabbitmq_data da1_data sequencer_data prover_state gateway_state archive_relay_data; do
  docker run --rm -v zeko-sepolia_${v}:/data:ro -v "$PWD/backup":/backup alpine \
    tar czf /backup/${v}.tgz -C /data .
done
docker compose start
```

### Destroying the rollup

::: danger Irreversible
`docker compose down -v` deletes every named volume, including the DA database with your genesis diff and the sequencer ledger. Only run it after a verified backup, and never on a rollup that still holds user funds.
:::

```bash
docker compose down -v        # only after a verified backup
```

## What this guide does not cover

- Building, tagging or publishing the images; `sepolia-poc` is the one tag this guide expects.
- Real proving (see [Proving](#proving)), restore from backup, a multi-node DA committee and a public-host deployment.
- Blob data availability, high availability, monitoring, contract upgrades or emergency procedures.
