FROM node:latest AS base
#### BASE STAGE
#### Installs moon.
WORKDIR /app

# Install moon binary
RUN curl -fsSL https://moonrepo.dev/install/moon.sh | bash
ENV PATH="/root/.moon/bin:/root/.proto/bin:$PATH"

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
COPY --from=skeleton /app/.moon/docker/workspace .
COPY --from=skeleton /app/patches ./patches
# Install dependencies
# ENV MOON_LOG=trace
# ENV MOON_DEBUG_PROCESS_ENV=true
RUN moon --version
RUN moon docker setup

# Copy project sources
COPY --from=skeleton /app/.moon/docker/sources .

# Build the project
RUN moon actions-indexer:build

    # Prune extraneous dependencies
RUN moon docker prune

#### START STAGE
#### Runs the project.
FROM oven/bun AS start
WORKDIR /app

COPY --from=build /app .
EXPOSE 3000
ENV NODE_ENV=production
CMD ["bun", "./services/actions/indexer/dist/index.js"]