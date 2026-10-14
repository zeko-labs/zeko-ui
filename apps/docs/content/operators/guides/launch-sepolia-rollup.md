# Launch an Independent Rollup on Ethereum Sepolia

::: warning Independent, operator-owned rollup
This runbook launches a **fresh** Zeko L2 that settles on Ethereum Sepolia. Every key, contract, genesis ledger and configuration file is created by you and belongs to your rollup. It does not connect to, and is not operated by, the Zeko-run network. For the older Mina-backed stack, use the unchanged [Legacy: Launch a Mina-backed Rollup](./launch-rollup.md) guide instead.
:::

In this guide we create an independent Zeko rollup on Sepolia. The rollup posts settlement proofs through a **gateway** that speaks the Mina-compatible GraphQL the sequencer expects and submits SP1 proofs to the `ZekoSettlement` and `EthereumZekoBridge` contracts you deploy.

At a minimum you run: `Sequencer`, `Sequencer signer`, `Prover`, one `DA node` (quorum 1) with its `DA signer`, the `Gateway` (Ethereum settlement, bridge and Mina-compatible L1 façade), `Archive`, `Archive relay`, `Archive node API`, `Actions API`, `Actions indexer`, `Bridge UI`, `Explorer UI`, `PostgreSQL` and `RabbitMQ`. The [service configuration table](#service-configuration) lists the image of each.

We use [docker compose](https://docs.docker.com/reference/cli/docker/compose/) to define the whole stack in a single file. One-time preparation steps live in the same file under the `bootstrap` profile.

TL;DR skip to the [Bootstrap process](#bootstrap-process)

::: danger `docker compose down -v` erases your rollup
The named volumes hold the DA database, the sequencer ledger, PostgreSQL and the prover state. Removing them deletes state that cannot be regenerated. Never run `docker compose down -v` without a backup; see [Stopping the stack](#stopping-the-stack).
:::

## Prerequisites

> **Matching generations.** The gateway (`zeko-gateway`, from `ethereum-settlement`) and the sequencer (`zeko`) must come from matching revisions: since settlement commit `fdee833` the gateway refuses settlements without a *preparation reservation*, and only zeko sequencers that include commit `29ebfeff57` (`fix(sequencer): recover Ethereum settlements durably`) acquire one. The `sepolia-poc` images satisfy this; if you rebuild one side, rebuild the other from the same generation.

### System requirements

- Linux `x86_64` host (the published images are `x86_64-linux` only)
- **RAM: 64 GB minimum for the whole stack on one host.** The prover holds about 23 GB resident after compiling the circuits, the genesis export (step 5) compiles the same circuits a second time in its own container while the prover is running, and `build-guests` (step 6, one-time) needs 16 GB+; on the 64 GB test host the export completed with little headroom. The prover compiles the Zeko circuits at every start: minutes on a fast host (2.6 to 4.5 min on the test host), hours on a small one; the health check allows 8 h. Splitting the prover onto its own host halves the per-host need.
- Disk for PostgreSQL (four databases), the DA database and the sequencer ledger.
- A host that stays awake. Suspend freezes every container; nothing is lost, but settlement stops until the host wakes and the gateway has re-indexed the missed blocks (see Troubleshooting).

### Installed software

- `Docker` with Docker Compose **v2.24 or newer** (`docker compose`; the `env_file` `required: false` attribute used below needs v2.24+)
- `jq`, `sha256sum`, `curl`, `git`, `setfacl` (the `acl` package) on the host for the bootstrap recipes below
- `openssl` for the random tokens in step 1. It may be absent, for example on a NixOS host: run it ad hoc with `nix shell nixpkgs#openssl`, or replace each `openssl rand -hex 32` with `head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32`, which is an acceptable generator for every random token and password in this guide

No Foundry, Rust, OCaml or Node toolchain is needed on the host: `forge` and `cast` ship in the `zeko-bootstrap` image and every other binary ships in its service image.

### Operator-provided external inputs

| Input | Why | Notes |
| --- | --- | --- |
| Sepolia JSON-RPC URL | Gateway `RPC_URL`; `deploy --rpc-url` | Your own provider. Never share one key between unrelated services. |
| Funded Sepolia **admin/deployer** wallet | Deploys the contracts once | You fund it yourself; there is no faucet in this stack. |
| Funded Sepolia **gateway prover** wallet | Submits settlement and bridge transactions | Receives `PROVER_ROLE`. Must differ from admin. |
| **Upgrader** address | `UPGRADER_ROLE` on both proxies | Address only; keep the key offline. |
| Browser wallet for the lifecycle test | Deposits, L2 payments, withdrawals | [MetaMask Flask (Development)](https://chromewebstore.google.com/detail/metamask-flask-developmen/ljfoeinjpaedjfecbmggjgodbgkmjkjk) from the Chrome Web Store with a fresh seed; it installs the Zeko Snap and serves both the Sepolia and the Zeko side. Alternative for the Zeko side: Auro. See Lifecycle examples. |
| Proving mode | See below | This guide deploys the **mock verifier** path: no SP1 proof is verified on L1. Real proving is a variant, not the default. |

### Proving

The gateway runs the current **no-blob PoC** settlement path. From source (`api/src/main.rs`):

- `PROOF_SYSTEM` defaults to `groth16`; `plonk` is also accepted. Proofs are requested from the Succinct Prover Network. Paid proving uses the SP1 SDK network client, whose requester key is `NETWORK_PRIVATE_KEY` (named in `api/src/prover.rs` and `TESTNET_POC.md`). You fund that requester account with PROVE yourself.
- `API_REQUIRE_PROOF_APPROVAL=true` makes every network proof an explicit, capped approval step and requires `PROVER_GAS_LIMIT` and `PROVER_MAX_PRICE_PER_PGU` hard caps.
- `API_EXECUTE_ONLY=true` executes the guests locally and never submits anything (variant: nothing lands on L1).
- **This guide's default:** `API_LOCAL_MOCK_SUBMIT=true` with `API_UNSAFE_ALLOW_MOCK_ON_SEPOLIA=true` and contracts deployed with `LOCAL_MOCK_VERIFIER=true`. The gateway still executes the guests locally for their public values, then submits them with empty proof bytes to a `LocalSP1Verifier` that accepts anything (`DeployPoc.s.sol:29-30,58-62`; `api/src/ethereum.rs:462-487` checks on chain that the configured verifier is that mock). This gives **no** on-chain proof security and is only for disposable test deployments.

The Zeko-side prover (`zeko-prover`) is **not** mock: it compiles the real circuits from your configuration and proves every commit locally.

## Overview

![Sepolia rollup architecture: every service of the Compose file and the direction of each connection](./sepolia-rollup-architecture.png)

Legend: blue arrows are writes (send), green arrows are reads (receive), red arrows carry traffic both ways; orange boxes are the Zeko core components, black boxes are the supporting services. The sequencer is the hub: it reads the outer-account state and actions from the gateway's `/graphql` (labelled "L1/archive graphql"), signs through its signer, stores diffs in the DA layer and its PostgreSQL database, and hands proving work to the provers through RabbitMQ. The gateway is the only service that talks to Sepolia (JSON-RPC) and the only one that submits settlements. The archive relay copies DA diffs into the archive database that `archive-node-api` serves to the Actions indexer, while the bridge UI reaches the gateway, the sequencer and the Actions API directly from the browser.

We are going to:

- Create the Ethereum admin wallet and predict the deterministic contract addresses.
- Create the Zeko sequencer and DA keys, signer TLS material and the circuit/deploy configuration bound to the predicted bridge address.
- Start the long-lived Zeko services and run the exporter: one real first proof that yields the genesis ledger, the deployment manifest and the public settlement VK.
- Compile the SP1 guests against that VK, compute the program vkeys and deploy the contracts (dry run, then `--broadcast`).
- Start the gateway with the artifacts mounted, then the sequencer, archive stack, Actions services and UIs.

Nothing here builds images. Image references use the single fixed tag `docker.io/zekolabs/<name>:sepolia-poc`, published on Docker Hub by the Zeko release process; `docker compose up` pulls them. If your host has no access to Docker Hub, load the eleven images under that tag yourself before you start.

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

> **Note:** some variable names are source-defined and keep Mina wording (`MINA_PRIVATE_KEY`, `MINA_SIGNING_NETWORK_ID`, `VIRTUAL_MINA_*`). The signing network id of this stack is `testnet`; the bridge UI refuses anything else.

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

This guide targets a single Docker host without domain names. Every published port is bound to `127.0.0.1`, so the services are reachable only from that host and you use them in the browser as `http://localhost:<port>`; the same `http://localhost:<port>` URLs go into the UI runtime configs and `API_CORS_ALLOWED_ORIGINS`. The sequencer GraphQL endpoint answers CORS as well (`OPTIONS /graphql` → `204`, `Access-Control-Allow-Origin` on every `/graphql` response) and must stay open to any origin (`*`, the default): wallet Snaps query it from inside MetaMask's execution sandbox, whose origin is MetaMask's and not the bridge UI's, so an allow-list (`ZEKO_GRAPHQL_CORS_ALLOWED_ORIGINS`) breaks "Connect Zeko wallet" with `Failed to fetch`. The endpoint is public and credential-free, so `*` costs nothing. Compose service names (`gateway`, `sequencer`, …) are only resolvable between containers and stay backend-only. For a public host you would put a TLS reverse proxy in front of the browser-facing ports and replace the `http://localhost:<port>` values in the runtime configs and in `API_CORS_ALLOWED_ORIGINS` with the public origins; nothing else in this guide changes.

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

`umask 077` keeps everything you create private. The three `postgres-init` directories are the exception: the `postgres:16` container runs its initialization as its own `postgres` user, so that directory and the public SQL in it must be traversable and readable (`0755` / `0644`). `config/` itself stays `0700`; bind mounts do not need the container to traverse the host parent directory.

Copy `docker-compose.yaml` (below) into the workspace verbatim and create `.env` (mode `0600`). Values carry no quotes and no inline comments, so that the host shell can read single values back verbatim:

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

Compose reads `.env` for interpolation only; it does not export anything into your shell. The host commands below therefore read single values with this helper. Define it in **every** new shell you open in the workspace:

```bash
envget() { grep -m1 "^$1=" .env | cut -d= -f2-; }
```

The Compose file tolerates the empty later-phase values (`${VAR:-}`), so every bootstrap command works with this initial file. Each consuming service refuses to start while a value it needs is still empty: the `predict-address` and `deploy` roles exit on an empty `ADMIN_ADDRESS` (`nix/bootstrap/zeko-bootstrap`), and the gateway, sequencer and indexer shims below check their inputs before `exec`.

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
    image: rabbitmq:latest
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

The bootstrap profile has four one-shot services. Two of them are multi-role: `bootstrap` runs the `zeko-bootstrap` image's entrypoint with the role you pass as the first argument (`cast`, `predict-address`, `build-guests`, `vkey`, `deploy`), and `zeko-tools` runs the named binary from the `zeko` image (`zeko-cli`, `zeko-bootstrap-signer-tls`, `zeko-bootstrap-generate-config`). `bootstrap-l1` and `exporter` keep their fixed entrypoints because the exporter depends on `bootstrap-l1` by name. Accepted trade-offs of the merge: `build-guests` and `vkey` are no longer run with `network_mode: none` (the guest build is still offline by construction, `CARGO_NET_OFFLINE=true` and `--offline --frozen` in `nix/bootstrap/zeko-bootstrap`), and every `bootstrap` role sees `artifacts/` read-write, `config/deploy.env` and the `deployer_key` secret, not only the roles that need them. Likewise every `zeko-tools` binary sees `tls/` and `config/` read-write and shares `state/zeko-tools`.

> **Note:** `$$` is a literal `$` for the in-container shell (Compose interpolates single `$`). The signer, DA, sequencer, exporter, gateway and indexer containers read their `/run/secrets` files into the environment variables the binaries expect, because those binaries read secrets from the environment and Compose cannot map a file to a variable by itself. Flag values and `.env` entries would be visible in `docker inspect`; the file shim keeps them out. The same shims check the later-phase `.env` values, because the gateway accepts an empty string for its required variables (`required_env` in `api/src/main.rs`) and the indexer schema accepts empty strings (`services/actions/indexer/src/env.ts`).

> **Note:** Compose file secrets are bind mounts that keep the host file's owner and mode. The zeko images run as root and the one-shot roles run as you (`ZEKO_UID`), so they read your `0600` files directly. The gateway and the Actions indexer run as uid `65532` (`ethereum-settlement/nix/docker.nix`, `zeko-ui/nix/docker.nix`), so step 1 grants that uid read access to exactly the four files they consume with an ACL; the files stay `0600` for everyone else.

### Step 1: Admin wallet and other secrets

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

`-T` disables the pseudo-terminal so that captured output has no terminal line endings. When you later fill `secrets/sp1_network_key`, edit it in place (`>`), which keeps the ACL; recreating the file drops it.

Fund `ADMIN_ADDRESS` (one-time deployment gas) and the gateway prover address (ongoing settlement gas) with Sepolia ETH. If you have no Sepolia ETH, the proof-of-work faucet at <https://sepolia-faucet.pk910.de/> mines it in your browser; a few hours of mining covers the deployment. The upgrader wallet needs no funds now; it only holds `UPGRADER_ROLE`. Nothing on this host uses its key, so move `secrets/upgrader-wallet.json` to offline storage once the contracts are deployed.

### Step 2: Predict the contract addresses

The PoC factory uses CREATE2, so the proxy addresses depend only on `ADMIN_ADDRESS`. The bridge proxy address is a **circuit input**: it must be known before the Zeko configuration is generated.

```bash
docker compose --profile bootstrap run --rm bootstrap predict-address
```

The role prints `SETTLEMENT_CONTRACT_ADDRESS 0x…` and `BRIDGE_CONTRACT_ADDRESS 0x…` (plus the factory and the local verifier). **Copy the two addresses by hand** into the matching empty lines of `.env`, replacing the placeholders below with the printed values:

```bash
sed -i "s#^SETTLEMENT_CONTRACT_ADDRESS=.*#SETTLEMENT_CONTRACT_ADDRESS=<printed settlement address>#; s#^BRIDGE_CONTRACT_ADDRESS=.*#BRIDGE_CONTRACT_ADDRESS=<printed bridge address>#" .env
grep -E '^(SETTLEMENT|BRIDGE)_CONTRACT_ADDRESS=0x' .env     # both lines must show a real 0x address
``` Forge fetches `solc` into `state/bootstrap` on first use.

### Step 3: Zeko keys, signer TLS and circuit configuration

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

`generate-even-key` prints `Private key: …` and `Public key: …` (`sequencer/cli.ml`); the output is captured into a private file and only the public keys are displayed, so the private keys never reach your terminal or shell history. `zeko-bootstrap-signer-tls` reports container paths under `/run/zeko/signer-tls`; that directory is the bind mount of `./tls`, so on the host the files are `tls/ca/signer.crt` and `tls/private/signer.key`, issued for the fixed name `zeko-signer`; all signer clients verify that name through `ZEKO_SIGNER_TLS_HOSTNAME`. `zeko-bootstrap-generate-config` runs `zeko-cli generate-circuits-config --ethereum-bridge-address …` and writes `config/circuits-config.json` and `config/deploy-config.json`. Both contain fresh private keys: back them up offline and never commit them.

### Step 4: Database initialization files

The official `postgres:16` image runs the scripts in `/docker-entrypoint-initdb.d` once, on first start of an empty data volume. The sequencer and the gateway create their own tables; the archive and the Actions services do not, and the published images ship no migration runner. The `exporter` database is a scratch database for the one-shot genesis export: the exporter and the sequencer must not share one, because the sequencer re-applies the genesis diff from DA on its first start and would hit a duplicate `da_diff` row. The three files below are therefore part of this guide. Expand each block, copy its content verbatim into the named file, then apply the modes:

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

The Actions block concatenates the migration files in timestamp order; later statements `ALTER` tables created by earlier ones, so keep the order. The `--> statement-breakpoint` markers are SQL comments and are ignored by `psql`. If you publish images from a different revision, regenerate both SQL blocks from the sources named in their headings.

> **Note:** one database role (`zeko`) owns all four databases in this example. The gateway sets its archive connections read-only itself. Per-service roles are an operator hardening step and are not required by source.

### Step 5: Start the long-lived Zeko services and export the genesis

```bash
docker compose up -d postgres rabbitmq sequencer-signer da1-signer da1 prover
docker compose ps            # wait until prover is healthy (circuit compilation: minutes to hours)
docker compose logs -f prover
```

Then run the export. It waits for the broker, signer, DA node and the bootstrap L1 stand-in, produces one real settlement proof, posts the genesis diff to `da1`, and writes into the empty `out/export/`:

`ZEKO_ETHEREUM_COMMIT_VALIDITY_PERIOD` (exporter) and `--commit-validity-period` (sequencer) must carry the same value; it is the number of virtual slots (12 s each) a commit stays valid for settlement, and it also sets the withdrawal delay (claimable at the commit's upper slot plus `WITHDRAWAL_DELAY_SLOTS`). The settlement tooling defaults to `2400` (8 hours) to leave room for network proving; this guide uses `100` (20 minutes) so that withdrawals in the mock-verifier demo can be claimed the same hour. The window must exceed the time from a commit to its Ethereum inclusion (a few minutes in the mock profile); raise both values before the export if you move to network proving. Changing them later is untested.

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

`artifacts/` must stay `0755` with `0644` files: the gateway runs as uid `65532` and reads it read-only. Steps 6 to 8 share shell variables (`SETTLEMENT_VKEY`, `BRIDGE_VKEY`, `VK_HASH`, `MANIFEST`, `SETTLEMENT`, `FORK_SLOT`, `envget`): run them in one shell, or repeat the assignments in a new one.

### Step 7: Deploy the contracts

`DeployPoc.s.sol` reads every parameter from the environment. First derive `FORK_SLOT` from the export: it is the lower bound of the exported proof's slot range, `.proof.binding.actions[0][6]` in `settlement.json` (hex), cross-checked against the upper bound in `[7]` (`ethereum-settlement/tools/prepare-poc.sh`). The contract and the gateway must both use this value, otherwise a nonzero commit range would silently start at slot zero (`TESTNET_POC.md`).

```bash
MANIFEST=out/export/deployment-manifest.json; SETTLEMENT=out/export/settlement.json
FORK_SLOT=$(( $(jq -er '.proof.binding.actions[0][6]' $SETTLEMENT) ))
SLOT_UPPER=$(( $(jq -er '.proof.binding.actions[0][7]' $SETTLEMENT) ))
(( FORK_SLOT <= SLOT_UPPER )) && echo "FORK_SLOT=$FORK_SLOT" || echo "invalid slot range [$FORK_SLOT, $SLOT_UPPER]: stop here" >&2
```

Then write the public values to `config/deploy.env` (mode `0600`):

```bash
{
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
} > config/deploy.env
chmod 0600 config/deploy.env
```

Set `VIRTUAL_MINA_FORK_SLOT` in `.env` to the same `FORK_SLOT` value now.

Deploy inputs and their source (`contracts/script/DeployPoc.s.sol`):

| Variable | Meaning |
| --- | --- |
| `PRIVATE_KEY` | Deployer key; the `deploy` role reads it from `secrets/deployer_key`. Must belong to `ADMIN_ADDRESS`. |
| `LOCAL_MOCK_VERIFIER` | `true` here: both proxies trust the `LocalSP1Verifier` the script deploys at the predicted `LOCAL_SP1_VERIFIER_ADDRESS` (insecure; demo only). Real proving instead sets `SP1_VERIFIER_ADDRESS` to the official SP1 v6.1.0 Groth16 verifier `0xb69f2584CBcFf99a58C4e7002E8b89Af54a6f4e2` (`V6_1_0_SP1_VERIFIER_GROTH16` in `sp1-contracts` `deployments/11155111.json`, as `tools/prepare-poc.sh:31` reads it; not the `V6_1_0_BROKEN_*` entries). |
| `SETTLEMENT_PROGRAM_VKEY`, `BRIDGE_PROGRAM_VKEY` | SP1 program vkeys from step 6 |
| `SETTLEMENT_VK_HASH` | SHA-256 of `settlement-vk.serde.json` (= manifest `settlementVkSha256`) |
| `INITIAL_OUTER_STATE_0…7`, `INITIAL_OUTER_ACTION_STATE` | Genesis outer state from the export |
| `GATEWAY_PROVER_ADDRESS`, `UPGRADER_ADDRESS` | Receive `PROVER_ROLE` and `UPGRADER_ROLE`. The script enforces three distinct addresses only with a real verifier; this guide keeps them distinct anyway |
| `GENESIS_TIMESTAMP`, `SLOT_DURATION`, `FORK_SLOT`, `WITHDRAWAL_DELAY_SLOTS` | Defaults: current block timestamp, `12`, `0`, `5`; `FORK_SLOT` is set to the export's lower slot above |

Dry run first, then broadcast:

```bash
SEPOLIA_RPC_URL=$(envget SEPOLIA_RPC_URL)
docker compose --profile bootstrap run --rm bootstrap deploy --rpc-url "$SEPOLIA_RPC_URL"
docker compose --profile bootstrap run --rm bootstrap deploy --rpc-url "$SEPOLIA_RPC_URL" --broadcast --slow --gas-estimate-multiplier 800
```

`--slow` sends one transaction at a time and stops at the first failure; `--gas-estimate-multiplier 800` multiplies Forge's gas estimate by eight. Both are needed because Forge estimates gas with its bundled EVM, and Sepolia's fork of 2026-10-06 prices contract creation about 6.5 times higher than that EVM models (the node's `eth_estimateGas` for the factory creation returns about 3.4M gas against Forge's 527k). With a smaller margin the factory `CREATE2` fails with `contract creation code storage out of gas`, and without `--slow` Forge then sends every remaining call to the missing factory as a no-op. To check the margin before broadcasting, compare Forge's estimate for the first transaction with the chain's: `cast estimate 0x4e59b44847b379578588920cA78FbF26c0B4956C --from "$(envget ADMIN_ADDRESS)" --rpc-url "$SEPOLIA_RPC_URL" <input of transactions[0] in state/bootstrap/forge-workspace/broadcast/DeployPoc.s.sol/11155111/dry-run/run-latest.json>`. The CREATE2 addresses do not depend on the attempt, so a failed deployment is simply re-run. Compare the printed proxy addresses with step 2. Forge's records are in `state/bootstrap/forge-workspace/broadcast/`; set `ETHEREUM_INDEXER_START_BLOCK` in `.env` to the block of the first transaction (the factory creation; every later transaction is in that block or after), not to the current head:

```bash
START_BLOCK=$(( $(jq -r '.receipts[0].blockNumber' state/bootstrap/forge-workspace/broadcast/DeployPoc.s.sol/11155111/run-latest.json) ))
sed -i "s#^ETHEREUM_INDEXER_START_BLOCK=.*#ETHEREUM_INDEXER_START_BLOCK=$START_BLOCK#" .env
grep '^ETHEREUM_INDEXER_START_BLOCK=' .env
```

### Step 8: Gateway inputs: virtual accounts and public keys

The gateway serves a Mina-compatible account view. Seed it from the export (`VIRTUAL_MINA_ACCOUNTS_PATH`, `api/src/main.rs initialize_gateway_config`):

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
- `VIRTUAL_MINA_INNER_PUBLIC_KEY` = the inner account public key in `out/export/genesis-ledger.json`: the file is a list of `[index, account]` pairs and the inner account is index `0` (`zeko_constants.ml` `inner_account_index = 0`), so `jq -r '.[] | select(.[0]==0) | .[1].public_key' out/export/genesis-ledger.json`
- `VIRTUAL_MINA_GENESIS_TIMESTAMP` = the contract's genesis timestamp as RFC 3339:
  ```bash
  SETTLEMENT_CONTRACT_ADDRESS=$(envget SETTLEMENT_CONTRACT_ADDRESS); SEPOLIA_RPC_URL=$(envget SEPOLIA_RPC_URL)
  TS=$(docker compose --profile bootstrap run --rm -T bootstrap cast call "$SETTLEMENT_CONTRACT_ADDRESS" \
    'genesisTimestamp()(uint64)' --rpc-url "$SEPOLIA_RPC_URL" | awk '{print $1}')
  date -u -d "@$TS" +%Y-%m-%dT%H:%M:%SZ
  ```
- `VIRTUAL_MINA_FORK_SLOT` = the `FORK_SLOT` derived in step 7 and deployed with (already set there).

### Step 9: UI runtime configuration

Both UIs fetch `/runtime-config.json` from their own origin at load time; the static server returns the mounted file. **Every URL in these files is used by the browser**, so use the `http://localhost:<published port>` addresses from the Ports table, never Compose service names.

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

Field rules come from `bridge-ui/src/lib/config.ts` and `explorer-ui/src/lib/runtime.ts`: `schemaVersion` must be `1`, `minaSigningNetworkId` must be `testnet`, `expectedEthereumChainId` must be `11155111` (Sepolia), `pollIntervalMs` between `1000` and `60000`. Set `API_CORS_ALLOWED_ORIGINS` in `.env` to the bridge and explorer origins, `http://localhost:4174,http://localhost:4175`. The sequencer is not on that list on purpose: it allows any origin (`ZEKO_GRAPHQL_CORS_ALLOWED_ORIGINS` unset), because the MetaMask Snap calls it from MetaMask's own origin. Leave the Actions API `ENVIRONMENT` at a value other than `sepolia` (that value pins CORS to Zeko's own bridge host); with any other value, such as `independent`, the API reflects the request origin (`services/actions/api/src/cors.ts:17`), so `http://localhost:4174` is accepted.

### Step 10: Start the stack

```bash
docker compose up -d
docker compose ps
docker compose logs -f gateway sequencer
```

The gateway logs `loaded settlement artifacts` with the VK hash, checks both SP1 program vkeys against the contracts and only then serves. If you start the stack within ~15 minutes of deploying, the sequencer logs `Commit is paused … programVKey returned no data` until Sepolia finalizes the deployment; harmless. The sequencer syncs its ledger from the DA genesis diff and then opens port `1923` (`/healthz`, `/readyz` and GraphQL; about a minute); `archive-relay` waits for that. `/readyz` answers `ready` once settlement is possible. The sequencer starts after the gateway is healthy. In the mock-verifier profile the gateway also checks on chain that the settlement verifier is the `LocalSP1Verifier` and refuses to start otherwise. Produce one commit and confirm its job in `GET /v1/proofs` (header `x-api-key: <gateway_api_key>`) is submitted and the settlement proxy's state advances on Sepolia. Real proving instead means: contracts deployed with the real verifier, `API_EXECUTE_ONLY=true` for a first executed-only commit, then `API_EXECUTE_ONLY=false`, `API_LOCAL_MOCK_SUBMIT=false`, `API_UNSAFE_ALLOW_MOCK_ON_SEPOLIA=false`, `API_REQUIRE_PROOF_APPROVAL=true`, `PROVER_GAS_LIMIT`, `PROVER_MAX_PRICE_PER_PGU`, `secrets/sp1_network_key` filled, then `docker compose up -d gateway`.

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
| Sequencer | Gateway | `--l1-uri http://gateway:8080/graphql` and `--archive-uri http://gateway:8080/graphql` (outer-account actions: deposits to synchronize; the gateway serves them on `/graphql`, not on `/archive/graphql`, which is the L2 archive) (settlement submission with `ZEKO_ETHEREUM_GATEWAY_TOKEN`); `--archive-uri http://gateway:8080/graphql` (L1 action reads) |
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

`L2_ARCHIVE_URL` must be the full GraphQL endpoint of the archive-node-api. The pinned upstream (`zeko-labs/archive-node-api`, `src/server/server.ts`) creates graphql-yoga with `graphqlEndpoint: '/'`, `healthCheckEndpoint: '/healthcheck'` and no landing page, and `src/index.ts` listens on `PORT` (default `8080`): GraphQL is served at the **root path only**, there is no `/graphql` route. The service is not published to the host; probe it from inside the Compose network (the image contains `curl`):

```bash
docker compose exec archive-node-api curl -s -X POST -H 'content-type: application/json' \
  --data '{"query":"query { __typename }"}' http://127.0.0.1:8080/
```

## Lifecycle examples

All browser steps happen in the bridge UI (`http://localhost:4174`); it uses only the browser-facing `http://localhost:<port>` endpoints and never receives the gateway API key.

### Deposit ETH to the rollup

1. In the bridge UI connect an Ethereum wallet on Sepolia and a Zeko wallet. The bridge configures the Zeko endpoint (`sequencerGraphqlUrl`) and uses signing network `testnet`. Two Zeko wallets work:
   - **MetaMask Flask with the Zeko Snap** (one wallet for both sides). The bridge image is built with the Snap ID `npm:@mondejka/mina-snap` (`bridge-ui/README.md`); that package is published but not yet allowlisted by MetaMask, so ordinary MetaMask refuses it and you need MetaMask Flask, the developer build: install it from the Chrome Web Store as [MetaMask Flask (Development)](https://chromewebstore.google.com/detail/metamask-flask-developmen/ljfoeinjpaedjfecbmggjgodbgkmjkjk) (Firefox and other browsers: see [Install MetaMask Flask](https://docs.metamask.io/snaps/get-started/install-flask/)). Disable the regular MetaMask extension while Flask is active (both inject `window.ethereum`), create a fresh recovery phrase in Flask (never a funded production seed), switch it to Sepolia and send it a little Sepolia ETH. Then click **Connect Zeko wallet** → **MetaMask Snap**: Flask asks to install the Snap, then to "Contact network" (the Snap itself queries `sequencerGraphqlUrl`, which is why the sequencer must allow any origin), and the derived `B62…` account appears.
   - **Auro**: add a custom network with GraphQL endpoint `http://localhost:1923/graphql` in Auro Settings → Networks, select it, then connect.
2. Deposit ETH to your `B62…` account. The transaction calls `depositNative` on the bridge proxy; the gateway indexes the `BridgeDeposit` log once Sepolia reports it `finalized` (`ETHEREUM_FINALITY_MODE=finalized`). Follow it at `GET <gateway>/v1/bridge/deposits/:nonce` (nonces start at `1`; until the block is finalized the endpoint answers `canonical deposit not found`; then `status: locked`, `nextAction: requestBridgeProof`).
3. The gateway queues the bridge proof itself (`BRIDGE_AUTO_PROVE_DEPOSITS=true` in the Compose; it polls every 5 s and admits the batch as soon as no settlement is queued or active). The manual alternative, `curl -X POST -H "x-api-key: $(cat secrets/gateway_api_key)" http://localhost:8080/v1/bridge/deposits/prove`, is refused with `a settlement is queued or active` whenever a settlement is in flight, and with the idle settlement cycle described below that is most of the time. In the mock-verifier profile the job executes the bridge guest locally and submits to the bridge proxy within a few minutes (`status: submitted`, deposit `nextAction: waitForEthereumSubmission`); that Sepolia transaction must itself become finalized before the next real commit synchronizes the deposit, after which the endpoint reports `finalizeDepositOnZeko`.
4. Back in the bridge UI, finalize the deposit: the UI asks the Actions API for the witness, you sign the `finalizeDeposit` update in your Zeko wallet, and the UI submits it to the sequencer. The credit is immediate on L2: `account(publicKey: "B62…") { balance { total } }` on `http://localhost:1923/graphql` shows the amount in nine-decimal units minus the bridge fee (the guided run: 0.05 ETH deposit → `49990000`). The gateway's deposit view stays at `finalizeDepositOnZeko`; that is its terminal state, it does not observe the L2 claim.

### Send an L2 transaction

The bridge UI's **Wallet** tab sends native ETH (and bridged tokens) on Zeko with the connected Zeko wallet, Snap or Auro. With Auro directly, add your rollup as a custom network (name = `auroNetworkName`, GraphQL endpoint = `sequencerGraphqlUrl`), select your `B62…` account and send a payment. Zeko uses 9 decimals: 1 ETH = `1000000000` L2 base units. Query the sequencer directly:

```bash
curl -s -H 'content-type: application/json' --data '{"query":"query { __typename }"}' http://localhost:1923/graphql
```

### Observe settlement

Every `--commitment-period` with something to commit (a deposit action or L2 transactions), the sequencer applies it, posts the diff to DA, the prover proves the commit (about 20 s on the test host once circuits are compiled), and the sequencer sends the proof export to the gateway `/graphql` (`sendZkapp` with the gateway token, holding a settlement reservation). The gateway executes the settlement guest and, in the mock-verifier profile, submits within minutes; in the guided run the first settlement was on Sepolia three minutes after the sequencer picked up the deposit. Each settlement also emits a `Commit` action on the outer account, which the sequencer synchronizes into the inner account with an internal transaction, and the current sequencer then settles that transaction too: expect one settlement per Sepolia finality window (about 20 minutes, ~931k gas each) even with no user traffic. `--inner-sync-period` is meant to absorb such commit-only batches without a commit, but in the guided run it did not stop the cycle (the committer still settled the synchronization transaction), so the Compose leaves it unset; a sequencer-side fix is tracked as a follow-up. Watch the job: `curl -H "x-api-key: …" http://localhost:8080/v1/proofs` and `/v1/proofs/:id`. In approval mode inspect `GET /v1/proofs/:id/quote` and `POST /v1/proofs/:id/approve` with explicit PGU and price caps. The explorer UI lists settlements from `GET <gateway>/v1/explorer/settlements`; the Ethereum transaction is visible on Sepolia Etherscan under the settlement proxy.

### Withdraw to Ethereum

1. In the bridge UI request a withdrawal from Zeko to your `0x…` address; the UI prepares the witness through the Actions API and you sign the L2 transaction.
2. A later settlement binds the withdrawal into the V2 Keccak root. `GET <gateway>/v1/bridge/withdrawals?recipient=0x…` returns the Merkle path and delay status.
3. The claimable slot is the binding settlement's upper commit slot plus `WITHDRAWAL_DELAY_SLOTS` (`EthereumZekoBridge.sol:701`), and the upper commit slot is the commit's slot plus the commit validity period (`--commit-validity-period 100` = `ZEKO_ETHEREUM_COMMIT_VALIDITY_PERIOD`). With the values in this guide a withdrawal therefore becomes `claimable` about 21 minutes (105 virtual slots of 12 s) after its settlement, not after 5 slots; `GET …/v1/bridge/withdrawals` shows `claimableSlot`, and `currentVirtualSlot()` on the settlement proxy shows the clock. Then claim in the bridge UI with your Ethereum wallet (`claimNativeWithdrawal`).

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

| Symptom | Cause / fix |
| --- | --- |
| any `zeko*` image: `Unix_error "Permission denied" mkdir "((dirname /tmp) …"` | The zeko-side images ship no `/tmp`; a process running as your uid cannot create it. Every such service in the Compose above mounts `tmpfs: /tmp:mode=1777`; keep that when you edit the file. |
| `deploy --broadcast`: `Transaction Failure: 0x…` on the first transaction; `debug_traceTransaction` shows `contract creation code storage out of gas` | Forge's gas estimate is below live Sepolia costs. Re-run the broadcast with `--slow --gas-estimate-multiplier 800` (the runbook command); if it still fails, compare `cast estimate` on the chain with Forge's estimate and raise the multiplier accordingly. Any no-op calls Forge already sent are harmless; the addresses are deterministic. |
| `sequencer` loops on `Failed to send zkapp command: Graphql_error: RESERVATION_REQUIRED` | Gateway and sequencer generations do not match (see Prerequisites). Rebuild `zeko` from a revision that includes `29ebfeff57` and recreate the sequencer with an empty `sequencer` database and volume. |
| `sequencer` exits once with `duplicate key value violates unique constraint "da_diff_target_ledger_hash_key"` | The exporter and the sequencer shared a database. Point `ZEKO_BOOTSTRAP_POSTGRES_URI` at the `exporter` database (default Compose) or start the sequencer with an empty `sequencer` database. |
| `archive-node-api` logs `TypeError: Cannot read properties of undefined (reading 'height')` on `networkState`, and `actions-indexer` reports `inner iteration failed: [GraphQL] Unexpected error` | The archive has no block yet (`network-service.ts:36` indexes the first canonical row unconditionally). Harmless until the first L2 transaction produces a block; the indexer retries every interval. |
| `sequencer` logs `All new actions: 0` forever although a deposit is `bridgeProven` (`outerActionSequence` set) | `--archive-uri` points at the gateway\'s `/archive/graphql` (the L2 archive). Outer-account actions are served by `/graphql`; set `--archive-uri http://gateway:8080/graphql` (runbook Compose) and recreate the sequencer. |
| sequencer: `Commit is paused: Ethereum gateway /v1/settlement-reservations: HTTP 503 … contract call to \`programVKey\` returned no data ("0x")` right after the first start | The gateway reads the contracts at Sepolia's **finalized** block (`ETHEREUM_FINALITY_MODE=finalized`), and the deployment is not finalized yet. Clears by itself once finality passes the deployment blocks (10 to 15 minutes); the sequencer retries. |
| After the host slept (laptop suspend): gateway `retrying transient Ethereum RPC read failure` bursts, then silence; sequencer `Commit is paused: Ethereum gateway /v1/settlement-reservations timed out`; a bridge or settlement job stays `submitted` with a stale `confirmations` count; `GET …/readyz` on the sequencer says `waiting_for_outer_writer` | Nothing is broken: containers were frozen with the host. On wake the gateway re-indexes every missed Sepolia block (about 3 blocks/s; an 11-hour sleep took 20 minutes) and only then advances its finality marker, confirms the pending job and releases the outer writer; the sequencer retries the reservation every 15 s and resumes by itself. Do not restart anything; if you must, restart the gateway only. A rollup that should keep settling needs a host that does not sleep. |
| `exporter` prints nothing and never exits | It is waiting for `127.0.0.1:8080`: `bootstrap-l1` binds to localhost only, so the exporter must run with `network_mode: "service:bootstrap-l1"` (as in the Compose above). Check `docker top <exporter container>` for the `sleep 1` loop. |
| `prover` unhealthy for a long time | Circuit compilation; `start_period` is 8 h. Compare with the log: compilation took 4.5 min on a 24 GB test host. Check memory. |
| gateway exits naming the artifacts directory | `artifacts/` missing one of `settlement-program`, `bridge-program`, `settlement-vk.serde.json`, or not readable by uid 65532 |
| gateway exits on program vkey mismatch | Guests/VK differ from what the contracts were initialized with: redo steps 6–7 consistently |
| gateway warns `Zeko archive schema is not ready` | Normal until the archive has written its first blocks |
| exporter: `refusing to export into non-empty /out` | Empty `out/export/` yourself to re-run |
| exporter: `ZEKO_DEPLOYMENT_SEQUENCER_PRIVATE_KEY does not match the signer endpoint` | `secrets/sequencer_key` is not the key the sequencer signer runs with |
| `da1` exits at start | Its signer is unreachable; it fetches the signer key once at startup |
| indexer GraphQL errors | Check `L1_ARCHIVE_URL` (gateway `/graphql`, which serves the outer-account actions; `/archive/graphql` is the L2 archive and returns none) and `L2_ARCHIVE_URL` (archive-node-api root path; probe in [Connection map](#connection-map)) |
| gateway or indexer logs `Permission denied` on `/run/secrets/…` | The ACL from step 1 is missing (`getfacl secrets/<file>` must list `user:65532:r--`); re-run the `setfacl` line |
| postgres init fails with `Permission denied` or `No such file` | `config/postgres-init` and its subdirectories must be `0755` and the SQL files `0644`; re-run step 4 on an **empty** `postgres_data` volume |
| bridge UI shows a config error | `/runtime-config.json` not mounted or fails validation (chain id, `testnet`, URLs) |
| bridge UI requests to `:1923` fail CORS (preflight `OPTIONS /graphql` returns `404`, or no `Access-Control-Allow-Origin`) while host `curl` succeeds | A `404` on the preflight means the `zeko` image predates the sequencer CORS support (`src/app/cli/src/init/graphql_internal.ml`, `Cors` module and the `OPTIONS` arm); rebuild and retag it. A `204` without `Access-Control-Allow-Origin` means someone set `ZEKO_GRAPHQL_CORS_ALLOWED_ORIGINS` on the sequencer; remove it (the Snap needs `*`). Check with `curl -i -X OPTIONS -H 'Origin: http://localhost:4174' -H 'Access-Control-Request-Method: POST' http://localhost:1923/graphql`. |
| "Connect Zeko wallet" with the MetaMask Snap fails with `Failed to fetch` right after the "Contact network" approval | The Snap fetches the sequencer from MetaMask\'s execution origin, which an allow-list on the sequencer rejects. Leave `ZEKO_GRAPHQL_CORS_ALLOWED_ORIGINS` unset (default `*`) and recreate the sequencer. |

## Stopping the stack

Stop or remove containers **without** touching volumes:

```bash
docker compose stop          # keep containers
docker compose down          # remove containers and network, keep volumes
```

### Backup and export

Back up, offline and encrypted: `secrets/`, `config/` (the circuit/deploy configuration holds private keys), `tls/`, `out/export/`, `artifacts/`, `state/bootstrap/forge-workspace/broadcast/`, `state/exporter/` (the exporter's sequencer `db-dir`, which together with `da1_data` is the state the L2 continues from; `zeko/nix/bootstrap-roles/README.md`), and all seven named volumes. `rabbitmq_data` (queues), `prover_state` (compiled circuits) and `gateway_state` (gateway home) could be rebuilt from the configuration, but restoring them avoids hours of recompilation, so back them up too:

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
`docker compose down -v` deletes every named volume: the DA database with your genesis diff, the sequencer ledger, PostgreSQL and the prover state. Combined with deleting the workspace it destroys every private key of the rollup. Only run it after a verified backup, and never on a rollup that still holds user funds.
:::

```bash
docker compose down -v        # only after a verified backup
```

## What this guide does not cover

- Building, tagging or publishing the images. `sepolia-poc` is the one tag this guide expects; the companion walkthrough covers building, tagging and pushing it.
- Verifying the Compose file, the runtime and the integration end to end: that is the operator's job on their own host. This guide was written from the service sources and has not been executed against a live Sepolia deployment.
- Blob data availability, multi-node DA committees, high availability, monitoring, contract upgrades or emergency procedures.
