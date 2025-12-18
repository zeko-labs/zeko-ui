# Launch a Rollup

In this guide we will create a `betternet` - an L2 Zeko Rollup for Mina Devnet.

At a minimum, you need to run the following components:

- `Sequencer`
- `DA Layer`
- `Prover`

We will use [docker compose](https://docs.docker.com/reference/cli/docker/compose/) to define the whole stack in a single file.

TL;DR skip to the [Bootstrap process](#bootstrap-process)

## Prerequisites

### System Requirements

- Linux or macOS (Windows WSL2 works too)
- At least **4 CPU cores**, **24GB RAM**

### Installed Software

- `Docker`

## Overview

In this guide we are going to:

- Create a `sequencer` wallet and make sure it has funds.
- Create a `faucet` wallet.
- Create a `deployment`/`circuits` config
- Deploy a created configuration
- Start a `betternet` L2 stack

### Wallets

Deploying a rollup the following wallets are mentioned:

- `sequencer` - A wallet to commit to zkApp. _**Has to be even**_
- `faucet` - A wallet that holds the funds. _**Cannot reuse sequencer's wallet**_
- `da-layer` - Each `da-layer` node is started with its wallet.
- `fee-payer` - A wallet that pays fees on commits. (We will use `sequencer`)
- `pause` - A wallet authorised to pause rollup. _**Has to be even**_ (We will use `sequencer`).

### Project Structure

Layout of the project directory:

```
project-root/
├── docker-compose.yml
├── keys/
├── data/
│   ├── postgresql/
│   ├── da-layer/
│   └── sequencer/
└── initdb/ # PostgreSQL init scripts
```

### Important Files

| File                                    | Purpose                                                      |
| --------------------------------------- | ------------------------------------------------------------ |
| `keys/sequencer-sk`                     | L1 private key used by sequencer to post proofs and pay fees |
| `keys/sequencer-pk`                     | L1 Public key used in deploy step                            |
| `keys/faucet-sk`                        | Faucet secret key used to distribute tokens inside L2        |
| `keys/faucet-pk`                        | Faucet public key                                            |
| `keys/da-node-sk`                       | Private key of the DA node                                   |
| `keys/da-node-pk`                       | Public key of the DA node (exposed to sequencer)             |
| `data/{postgresql,da-layer,sequencer}/` | Persistent storage for services                              |

> **Note:** Keys must NOT have newlines or extra spaces.

---

### Service Overview

- `postgresql` - Used by sequencer.
- `rabbitmq` - Messaging layer used between sequencer and prover.
- `da-layer` - Data Availability layer for the `betternet`.
- `prover` - Generates zk-proofs for work submitted by the sequencer.
- `sequencer` - Runs the rollup logic, batches transactions, interacts with DA layer, and posts proofs to L1.

### Ports Exposed

| Service   | Port   | Description          |
| --------- | ------ | -------------------- |
| sequencer | `1923` | Public API           |
| da-layer  | `1924` | DA API               |
| postgres  | `5432` | Local DB dev access  |
| rabbitmq  | `5672` | Internal service bus |

---

## Bootstrap process

### Getting/Creating configuration files

- Copy `docker-compose.yaml` to your project folder.
  ::: details Click to expand
  ```yaml
  services:
    init-config:
      image: docker.io/zekolabs/zeko:latest
      container_name: init-config
      user: "1000"
      working_dir: /data
      volumes:
        - ./data:/data
        - ./keys:/keys
      entrypoint:
        - sh
        - -c
      restart: "no"
      command: >
        "while [ ! -f /keys/.created ];
          do sleep 2;
        done; exit 0"
    init-deploy:
      image: docker.io/zekolabs/zeko:latest
      container_name: init-deploy
      depends_on:
        - init-config
        - da-layer
      working_dir: /data
      volumes:
        - ./data:/data
        - ./keys:/keys
      entrypoint:
        - bash
        - -c
      restart: "no"
      command: >
        "while [ ! -f /tmp/.deployed ]; do
          sleep 2;
        done; exit 0"
    postgres:
      image: postgres:16
      container_name: postgres
      environment:
        POSTGRES_DB: sequencer
        POSTGRES_USER: sequencer
        POSTGRES_PASSWORD: sequencer
      volumes:
        - ./data/postgresql:/var/lib/postgresql/data
        - ./initdb:/docker-entrypoint-initdb.d
      user: "1000"
      ports:
        - "5432:5432"
      restart: unless-stopped
    rabbitmq:
      image: rabbitmq:latest
      container_name: rabbitmq
      volumes:
        - rabbitmq_data:/var/lib/rabbitmq
      ports:
        - "5672:5672"
      restart: unless-stopped
    da-layer:
      depends_on:
        - init-config
      image: docker.io/zekolabs/zeko-da:latest
      container_name: da-layer
      user: "1000"
      ports:
        - "1924:1924"
      environment:
        ZEKO_SIGNATURE_KIND: "testnet"
      entrypoint: bash -c
      command: |
        "export MINA_PRIVATE_KEY=$(cat /keys/da-layer-sk) && \\
        exec zeko-da \\
        run-node \\
        --port 1924 \\
        --db-dir /db \\
        --network-id testnet"
      volumes:
        - ./data/da-layer:/db
        - ./keys:/keys:ro
      restart: always
    prover:
      image: docker.io/zekolabs/zeko:latest
      container_name: prover
      depends_on:
        - rabbitmq
        - init-config
      environment:
        ZEKO_SIGNATURE_KIND: "testnet"
        ZEKO_CIRCUITS_CONFIG: "/circuits-config.json"
        RABBITMQ_USER: "guest"
        RABBITMQ_PASSWORD: "guest"
      volumes:
        - ./data/betternet-circuits.json:/circuits-config.json:ro
      entrypoint: bash -c
      command: |
        "exec zeko-prover \\
        run-server \\
        --mq-host rabbitmq:5672"
      restart: on-failure
    sequencer:
      image: docker.io/zekolabs/zeko:latest
      container_name: sequencer
      depends_on:
        - init-deploy
        - rabbitmq
        - prover
        - postgres
        - da-layer
      environment:
        ZEKO_PROGRESS_STYLE: "percent"
        ZEKO_SIGNATURE_KIND: "testnet"
        ZEKO_CIRCUITS_CONFIG: "/circuits-config.json"
        POSTGRES_URI: "postgres://sequencer:sequencer@postgres:5432/sequencer"
        RABBITMQ_USER: "guest"
        RABBITMQ_PASSWORD: "guest"
      volumes:
        - ./data/sequencer:/data
        - ./data/betternet-circuits.json:/circuits-config.json:ro
        - ./keys:/keys:ro
      ports:
        - "1923:1923"
      entrypoint:
        - bash
        - -c
      command: |
        "export MINA_PRIVATE_KEY=$(cat /keys/sequencer-sk) && \\
        export DA_LAYER_KEY=$(cat /keys/da-layer-pk) && \\
        exec zeko-run \\
        -p 1923 \\
        --l1-uri https://gateway.mina.devnet.zeko.io \\
        --archive-uri https://gateway.mina.archive.devnet.zeko.io \\
        --max-pool-size 10 \\
        --commitment-period 300 \\
        --da-node da-layer:1924 \\
        --da-quorum 1 \\
        --da-key $$DA_LAYER_KEY \\
        --mq-host rabbitmq:5672 \\
        --db-dir /data/db \\
        --checkpoints-dir /data/checkpoints \\
        --postgres-uri postgresql://sequencer:sequencer@postgres:5432/sequencer \\
        --fee-modifier 0.1"
      restart: on-failure

  volumes:
    rabbitmq_data:
      name: rabbitmq
  ```
- Create the folder structure
  ```bash
  mkdir -p {initdb,keys,data/{sequencer,da-layer,postgresql}}
  ```
- Download [create_schema.sql](https://raw.githubusercontent.com/zeko-labs/zeko/compatible/src/app/archive/create_schema.sql) and place it inside ./initdb
- Create `./initdb/init.sql` with content:
  ```sql
  -- initdb/init.sql
  CREATE DATABASE sequencer;

  CREATE USER sequencer;
  ALTER DATABASE sequencer OWNER TO sequencer;
  ```
- Create `circuits`/`decploy` config and `sequencer`/`da-layer` keys
  1. Start and exec into `init-config` container:
  ```bash
  docker compose up init-config -d
  docker compose exec -it init-config bash
  ```
  > **Note:** This image is used to run Zeko sequencer/prover. Additionally it contains `zeko-cli`/`zeko-deploy` binaries.
  2. Create `deployment`/`circuits` config
  ```bash
  zeko-cli generate-circuits-config > generated-config
  csplit generated-config '/deploy config:/' '{*}'
  mv xx00 betternet-circuits.json
  mv xx01 betternet-deploy.json
  ```
  > **Note:** Currently `generate-circuits-config` produces a text file with both configuration and deploy. Therefore you need to manually remove `deploy config:`/`circuits config:` from created `betternet-circuits.json`/`betternet-deploy.json` files to make these `json` files valid. Since docker images do not contain any editor, in another shell navigate to your data folder and edit these files.
  3. Create `sequencer`/`da-layer` keypairs
  > **Note:** Or place your own keys inside ./keys):
  >
  > - `./keys/sequencer-pk`
  > - `./keys/sequencer-sk`
  > - `./keys/faucet-pk`
  > - `./keys/faucet-sk`
  > - `./keys/da-layer-pk`
  > - `./keys/da-layer-sk`

  ```bash
  # create `sequencer` keypair
  zeko-cli generate-even-key | while read label1 label2 value; do
  if [ "$label1" = "Private" ]; then
    echo "$value" > sequencer-sk
  elif [ "$label1" = "Public" ]; then
    echo "$value" > sequencer-pk
  fi
  done
  # create `faucet` keypair
  zeko-cli generate-even-key | while read label1 label2 value; do
  if [ "$label1" = "Private" ]; then
    echo "$value" > faucet-sk
  elif [ "$label1" = "Public" ]; then
    echo "$value" > faucet-pk
  fi
  done
  # create `da-layer` keypair
  zeko-cli generate-even-key | while read label1 label2 value; do
  if [ "$label1" = "Private" ]; then
    echo "$value" > da-layer-sk
  elif [ "$label1" = "Public" ]; then
    echo "$value" > da-layer-pk
  fi
  done

  mv {sequencer,faucet,da-layer}-{sk,pk} /keys
  touch /keys/.created
  ```
  > **Note:** After the `mv` operation, the `init-config` container should exit.

### Fund `sequencer` wallet

1. Using [Auro Wallet](https://www.aurowallet.com/) or other preferred method import sequencer key created in the previous step
2. Go to [Mina Devnet faucet](https://faucet.minaprotocol.com/) and use faucet to add funds to the `sequencer` wallet
3. After a few minutes you should be able to see the funds in your _**Auro Wallet**_

### Deploy `betternet` configuration

- Start and exec into `init-deploy` container:
  ```bash
  docker compose up init-deploy -d
  docker compose exec -it init-deploy bash
  ```
  > **Note:** It should also start `da-layer` container.
- From inside `init-deploy` container run deploy
  ```bash
  export MINA_PRIVATE_KEY=$(cat /keys/sequencer-sk)
  export ZEKO_DEPLOY_CONFIG=/data/betternet-deploy.json
  export ZEKO_CIRCUITS_CONFIG=/data/betternet-circuits.json
  export SEQUENCER_PK=$(cat /keys/sequencer-pk)
  export FAUCET_PK=$(cat /keys/faucet-pk)
  zeko-deploy --account-creation-fee 1 \
    --da-keys $(cat /keys/da-layer-pk) \
    --da-quorum 1 \
    --l1-uri https://gateway.mina.devnet.zeko.io \
    --pause-key $SEQUENCER_PK \
    --sequencer-key $SEQUENCER_PK \
    --faucet-account $FAUCET_PK \
    --da-node da-layer:1924 && \
    touch /tmp/.deployed
  ```
  You should see the output:
  ```
  outer secret key: EKE..
  outer public key: B62..
  holder secret key: EKD..
  holder public key: B62..
  token holder secret key: EKF...
  token holder public key: B62...
  Creating imt
  (* Post genesis batch *)
  (* Post the whole genesis diff with all the accounts *)
  (* Deploy contract *)
  ```
  > **Note:** If successful,`init-deploy` container should exit with `(0)`

### Wait for zkapp transaction to succeed

See example zkApp transaction status [here](https://minascan.io/devnet/account/B62qrWCK3mn8iYvopsRRfuUL9f6h2B6ydqHAYBVuBsh7eQ1BvQsqKrE/zk-txs)

### Start all services

```bash
docker compose up -d
```

### If all the steps were performed correctly you have the following:

- Sequencer exposing graphql endpoint under `http://localhost:1923/graphql`
- DA layer
- Prover accepting work from the sequencer.
- `rabbitmq` service used by sequencer/prover.
- `postgresql` service used by sequencer.

### Next steps

- Add your newly deployed `betternet` network to Aura wallet.
- Import faucet key into your Auro wallet.
- Create wallets and start sending transactions to your `sequencer`.

## Troubleshooting

Check logs

```bash
docker compose logs -f
```

## Stopping the Stack

```
docker compose down
```

To remove persistent data:

```
rm -rf data/
docker volume rm rabbitmq
```

## Next Steps

- Bridge Mina L1 tokens to L2 (TODO)
