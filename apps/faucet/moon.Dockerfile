#### BASE
FROM node:latest AS base
WORKDIR /app

RUN npm install -g @moonrepo/cli

RUN groupadd nodejs && useradd -r -g nodejs -m nodejs \
    && chown -R nodejs:nodejs /app
    
#### SKELETON
FROM base AS skeleton
USER nodejs

# Copy entire repository and scaffold
RUN chown -R nodejs:nodejs /app
COPY --chown=nodejs:nodejs . .
RUN moon docker scaffold faucet

#### BUILD
FROM base AS build
USER nodejs
ENV MOON_LOG=trace
ENV MOON_DEBUG_PROCESS_ENV=true

# Copy workspace skeleton
COPY --from=skeleton /app/.moon/docker/workspace .

# Install toolchain and dependencies
RUN moon docker setup

# Copy source files
COPY --from=skeleton /app/.moon/docker/sources .

# Prune workspace
RUN moon docker prune

# CMD
# Start the server by default, this can be overwritten at runtime
WORKDIR /app/apps/faucet
EXPOSE 3000
CMD [ "bun", "run", "start" ]