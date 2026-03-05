#### BASE STAGE
#### Installs proto and the pinned toolchain from .prototools.

FROM oven/bun:1.2.22 AS base
WORKDIR /app

COPY .prototools ./.prototools

RUN apt-get update \
	&& apt-get install -y --no-install-recommends bash ca-certificates curl git xz-utils \
	&& rm -rf /var/lib/apt/lists/*

# Install proto
RUN curl -fsSL https://moonrepo.dev/install/proto.sh | bash -s -- 0.55.3 --yes
ENV PROTO_HOME="/root/.proto"
ENV PATH="$PROTO_HOME/bin:$PROTO_HOME/shims:$PATH"

# Install the build toolchain pinned by .prototools.
# Bun is already provided by the base image at the pinned version.
RUN proto install --yes moon
RUN proto install --yes node
RUN proto install --yes npm
RUN proto install --yes pnpm
RUN moon --version

#### SKELETON STAGE
#### Scaffolds repository skeleton structures.

FROM base AS skeleton

# Copy entire repository and scaffold
COPY . .
RUN moon docker scaffold actions-indexer

#### BUILD STAGE
#### Builds the project.

FROM base AS build

# Copy workspace configs
COPY --from=skeleton /app/.moon/docker/configs .
COPY --from=skeleton /app/patches ./patches
RUN moon docker setup

# Copy project sources
COPY --from=skeleton /app/.moon/docker/sources .

# Build the project
RUN moon run actions-indexer:build

# Prune extraneous dependencies
RUN moon docker prune

#### START STAGE
#### Runs the project.

FROM oven/bun:1.2.22 AS start
WORKDIR /app

COPY --from=build /app .
EXPOSE 3000
ENV NODE_ENV=production
CMD ["bun", "./services/actions/indexer/dist/index.js"]
