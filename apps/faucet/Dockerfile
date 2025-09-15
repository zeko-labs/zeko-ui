# syntax = docker/dockerfile:1

# Adjust bun version as desired
FROM oven/bun:latest AS base

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

RUN bun install -g pnpm

# Throw-away build stage to reduce size of final image
FROM base AS build

# Install node modules
COPY . .
RUN pnpm install --production --filter faucet

# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
WORKDIR /app/apps/faucet
EXPOSE 3000
CMD [ "bun", "run", "start" ]