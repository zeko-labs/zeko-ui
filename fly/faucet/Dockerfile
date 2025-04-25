# syntax = docker/dockerfile:1

# Adjust bun version as desired
FROM oven/bun:latest AS base

LABEL fly_launch_runtime="Bun"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential dumb-init pkg-config python-is-python3

# Install node modules
COPY bun.lock package.json ./
RUN bun install

# Copy application code
COPY . .


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "bun", "run", "start" ]