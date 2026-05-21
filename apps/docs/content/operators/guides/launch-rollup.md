# Launch a Rollup

In this guide we will create a `betternet` - an L2 Zeko Rollup for Mina Devnet.

At a minimum, you need to run the following Zeko components:

- `Sequencer`
- `Sequencer signer`
- `DA Layer`
- `DA Layer signer`
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

![Architecture](./zeko-components.png)

We are going to:

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
└── docker-compose.yaml
```

> **Note:** `docker-compose.yaml` is using docker volumes to store data. If you prefer to mount local directories instead - change accordingly.

### Volumes/files

| Volumes           | Files                   | Purpose                                        |
| ----------------- | ----------------------- | ---------------------------------------------- |
| `keys_data`       | `sequencer-sk`          | L1 private key to post proofs and pay fees     |
| `keys_data`       | `sequencer-pk`          | L1 Public key used in deploy step              |
| `keys_data`       | `faucet-sk`             | Secret key used to distribute tokens inside L2 |
| `keys_data`       | `faucet-pk`             | Public key                                     |
| `keys_data`       | `da-node-sk`            | Private key of the DA node                     |
| `keys_data`       | `da-node-pk`            | Public key of the DA node (used by sequencer)  |
| `initdb_data`     |                         | Schema file(s) to bootstrap postgresql         |
| `postgresql_data` |                         | Persistent storage for postgresql              |
| `rabbitmq_data`   |                         | Persistent storage for RabbitMQ                |
| `circuits_data`   | `betternet-config.json` | Circuits config used by sequencer/prover       |
| `da-layer_data`   |                         | Persistent storage for da-layer                |
| `sequencer_data`  |                         | Persistent storage for sequencer               |

> **Note:** Keys must NOT have newlines or extra spaces.

---

### Service Overview

- `postgresql` - Used by sequencer.
- `rabbitmq` - Messaging layer used between the sequencer and the prover(s).
- `da-signer` - DA signer service that holds `da-layer` key.
- `da-layer` - Data Availability layer for the `betternet`.
- `prover` - Generates zk-proofs for work submitted by the sequencer.
- `sequencer-signer` - Sequencer signer service that holds `sequencer` key.
- `sequencer` - Runs the rollup logic, batches transactions, interacts with DA layer, and posts proofs to L1.

### Ports Exposed

| Service          | Port   | Description              |
| ---------------- | ------ | ------------------------ |
| sequencer-signer | `9000` | Sequencer signer service |
| sequencer        | `1923` | sequencer Graphql API    |
| da-signer        | `9001` | da-layer signer service  |
| da-layer         | `1924` | da-layer rpc API         |
| postgres         | `5432` | Database                 |
| rabbitmq         | `5672` | Messaging queue          |

---

## Bootstrap process

### Getting/Creating configuration files

- Copy `docker-compose.yaml` to your project folder.
  ::: details Click to expand `docker-compose.yaml`
  ```yaml
  services:
    init-db:
      image: docker.io/zekolabs/zeko:latest
      container_name: init-db
      volumes:
        - initdb_data:/data/initdb
        - circuits_data:/data/circuits
      entrypoint:
        - sh
        - -c
      command: >
        "echo 'ALTER DATABASE sequencer OWNER TO sequencer;' > /data/initdb/init.sql &&
        echo 'Bootstrap complete' && exit 0"
    init-config:
      image: docker.io/zekolabs/zeko:latest
      container_name: init-config
      working_dir: /data
      volumes:
        - circuits_data:/data/circuits
        - keys_data:/data/keys
      entrypoint:
        - sh
        - -c
      restart: "no"
      command: >
        "while [ ! -f /data/keys/.keys_created ];
          do sleep 2;
        done; exit 0"
    init-deploy:
      image: docker.io/zekolabs/zeko:latest
      container_name: init-deploy
      depends_on:
        init-config:
          condition: service_completed_successfully
        da-layer:
          condition: service_started
      working_dir: /data
      volumes:
        - circuits_data:/data/circuits
        - keys_data:/data/keys
      entrypoint:
        - bash
        - -c
      restart: "no"
      command: >
        "while [ ! -f /data/circuits/.deployed ]; do
          sleep 2;
        done; exit 0"
    postgres:
      depends_on:
        init-db:
          condition: service_completed_successfully
      image: postgres:16
      container_name: postgres
      environment:
        POSTGRES_DB: sequencer
        POSTGRES_USER: sequencer
        POSTGRES_PASSWORD: sequencer
      volumes:
        - postgresql_data:/var/lib/postgresql/data
        - initdb_data:/docker-entrypoint-initdb.d
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
    sequencer-signer:
      depends_on:
        init-config:
          condition: service_completed_successfully
      image: docker.io/zekolabs/zeko:latest
      container_name: sequencer-signer
      ports:
        - "9000:9000"
      entrypoint: bash -c
      command: |
        "export MINA_PRIVATE_KEY=$(cat /keys/sequencer-sk) && \\
        exec zeko-signer \\
        run \\
        --port 9000 \\
        --allow-zkapp-signing \\
        --max-fee 1 \\
        --max-balance-change 0"
      volumes:
        - keys_data:/keys:ro
      restart: always
    da-signer:
      depends_on:
        init-config:
          condition: service_completed_successfully
      image: docker.io/zekolabs/zeko-da:latest
      container_name: da-signer
      ports:
        - "9001:9001"
      entrypoint: bash -c
      command: |
        "export MINA_PRIVATE_KEY=$(cat /keys/da-layer-sk) && \\
        exec zeko-signer \\
        run \\
        --port 9001 \\
        --allow-field-signing"
      volumes:
        - keys_data:/keys:ro
      restart: always
    da-layer:
      depends_on:
        da-signer:
          condition: service_started
      image: docker.io/zekolabs/zeko-da:latest
      container_name: da-layer
      ports:
        - "1924:1924"
      environment:
        ZEKO_SIGNATURE_KIND: "testnet"
      entrypoint: bash -c
      command: |
        "exec zeko-da \\
        run-node \\
        --port 1924 \\
        --db-dir /data/db \\
        --signer da-signer:9001 \\
        --network-id testnet"
      volumes:
        - da-layer_data:/data
      restart: always
    prover:
      image: docker.io/zekolabs/zeko:latest
      container_name: prover
      depends_on:
        rabbitmq:
          condition: service_started
        init-config:
          condition: service_completed_successfully
      environment:
        ZEKO_SIGNATURE_KIND: "testnet"
        ZEKO_CIRCUITS_CONFIG: "/circuits/betternet-config.json"
        RABBITMQ_USER: "guest"
        RABBITMQ_PASSWORD: "guest"
      volumes:
        - circuits_data:/circuits:ro
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
        init-deploy:
          condition: service_completed_successfully
        sequencer-signer:
          condition: service_started
        rabbitmq:
          condition: service_started
        prover:
          condition: service_started
        postgres:
          condition: service_started
        da-layer:
          condition: service_started
      environment:
        ZEKO_PROGRESS_STYLE: "percent"
        ZEKO_SIGNATURE_KIND: "testnet"
        ZEKO_CIRCUITS_CONFIG: "/circuits/betternet-config.json"
        POSTGRES_URI: "postgres://sequencer:sequencer@postgres:5432/sequencer"
        RABBITMQ_USER: "guest"
        RABBITMQ_PASSWORD: "guest"
      volumes:
        - sequencer_data:/data
        - circuits_data:/circuits:ro
        - keys_data:/keys:ro
      ports:
        - "1923:1923"
      entrypoint:
        - bash
        - -c
      command: |
        "export DA_LAYER_KEY=$(cat /keys/da-layer-pk) && \\
        exec zeko-run \\
        -p 1923 \\
        --l1-uri https://gateway.mina.devnet.zeko.io \\
        --archive-uri https://gateway.mina.archive.devnet.zeko.io \\
        --max-pool-size 10 \\
        --commitment-period 300 \\
        --signer sequencer-signer:9000 \\
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
    initdb_data:
    postgresql_data:
    rabbitmq_data:
    circuits_data:
    sequencer_data:
    da-layer_data:
    keys_data:
  ```
- Start all services
  ```bash
  docker compose up -d
  ```
- Create `circuits`/`deploy` config and `sequencer`/`da-layer` keys
  1. Enter `init-config` container:
  ```bash
  docker compose exec -it init-config bash
  ```
  > **Note:** This image is used to run Zeko sequencer/prover. Additionally it contains `zeko-cli`/`zeko-deploy` binaries.
  2. Create `deployment`/`circuits` config
  ```bash
  zeko-cli generate-circuits-config \
    --circuits-config-output /data/circuits/betternet-config.json \
    --deploy-config-output /data/circuits/betternet-deploy.json
  ```
  3. Create `sequencer`/`da-layer` keypairs
  > - `/data/keys/sequencer-pk`
  > - `/data/keys/sequencer-sk`
  > - `/data/keys/faucet-pk`
  > - `/data/keys/faucet-sk`
  > - `/data/keys/da-layer-pk`
  > - `/data/keys/da-layer-sk`

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

  mv {sequencer,faucet,da-layer}-{sk,pk} /data/keys
  touch /data/keys/.keys_created
  ```

### Fund `sequencer` wallet

1. Using [Auro Wallet](https://www.aurowallet.com/) or other preferred method import sequencer key created in the previous step
2. Go to [Mina Devnet faucet](https://faucet.minaprotocol.com/) and use faucet to add funds to the `sequencer` wallet
3. After a few minutes you should be able to see the funds in your _**Auro Wallet**_

### Deploy `betternet` configuration

- Enter `init-deploy` container:
  ```bash
  docker compose exec -it init-deploy bash
  ```
  > **Note:** It should also start `da-layer` container.
- From inside `init-deploy` container run deploy
  ```bash
  export MINA_PRIVATE_KEY=$(cat /data/keys/sequencer-sk)
  export ZEKO_DEPLOY_CONFIG=/data/circuits/betternet-deploy.json
  export ZEKO_CIRCUITS_CONFIG=/data/circuits/betternet-config.json
  export SEQUENCER_PK=$(cat /data/keys/sequencer-pk)
  export FAUCET_PK=$(cat /data/keys/faucet-pk)
  zeko-deploy deploy-all --account-creation-fee 1 \
    --da-keys $(cat /data/keys/da-layer-pk) \
    --da-quorum 1 \
    --l1-uri https://gateway.mina.devnet.zeko.io \
    --pause-key $SEQUENCER_PK \
    --sequencer-key $SEQUENCER_PK \
    --faucet-account $FAUCET_PK \
    --da-node da-layer:1924 && \
    touch /data/circuits/.deployed
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

Check your sequencers zkApp transaction on Mina L1.
See example zkApp transaction status [here](https://minascan.io/devnet/account/B62qrWCK3mn8iYvopsRRfuUL9f6h2B6ydqHAYBVuBsh7eQ1BvQsqKrE/zk-txs)

### If all the steps were performed correctly you have the following:

- Sequencer signer that holds sequencer key
- Sequencer exposing graphql endpoint under `http://localhost:1923/graphql`
- DA signer that holds DA layer key
- DA layer
- Prover accepting work from the sequencer.
- `rabbitmq` service used by sequencer/prover.
- `postgresql` service used by sequencer.

### Configure Auro wallet browser extension

Import `sequencer`/`faucet` wallets into your Auro wallet.
![Import wallets](./import-wallet-to-auro.png)

Add/select your newly deployed `betternet` network.
![Configure betternet network](./select-betternet-network.png)

You can start sending transactions to your `sequencer`!

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
docker compose down -v
```
