# syntax = docker/dockerfile:1

#### BASE STAGE
#### Installs proto and the pinned toolchain from .prototools.

FROM node:24.5.0-bookworm-slim AS base
WORKDIR /app

COPY .prototools ./.prototools

RUN apt-get update \
	&& apt-get install -y --no-install-recommends bash ca-certificates curl git xz-utils \
	&& rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://moonrepo.dev/install/proto.sh | bash -s -- 0.55.3 --yes
ENV PROTO_HOME="/root/.proto"
ENV PATH="$PROTO_HOME/bin:$PROTO_HOME/shims:$PATH"

RUN proto install --yes moon
RUN proto install --yes node
RUN proto install --yes npm
RUN proto install --yes pnpm
RUN moon --version

#### SKELETON STAGE
#### Scaffolds repository skeleton structures.

FROM base AS skeleton

COPY . .
RUN moon docker scaffold faucet

#### BUILD STAGE
#### Installs and prunes the faucet workspace with the pinned toolchain.

FROM base AS build

COPY --from=skeleton /app/.moon/docker/configs .
COPY --from=skeleton /app/patches ./patches
RUN moon docker setup

COPY --from=skeleton /app/.moon/docker/sources .
RUN moon docker prune

#### START STAGE
#### Runs the faucet container service.

FROM oven/bun:1.2.22 AS start
WORKDIR /app

COPY --from=build /app .
EXPOSE 3000
ENV NODE_ENV=production
CMD ["bun", "run", "--cwd", "apps/faucet", "start"]
