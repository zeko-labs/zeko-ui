FROM node:latest
WORKDIR /app

# Install moon binary
RUN npm install -g @moonrepo/cli

# Copy workspace skeleton
COPY ./.moon/docker/workspace .

# Install toolchain and dependencies
RUN moon docker setup

# Copy source files
COPY ./.moon/docker/sources .

# Prune workspace
RUN moon docker prune

# CMD
# Start the server by default, this can be overwritten at runtime
WORKDIR /app/apps/faucet
EXPOSE 3000
CMD [ "bun", "run", "start" ]