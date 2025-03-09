ARG NODE_VERSION=22-slim

# Build phase
FROM --platform=linux/amd64 node:$NODE_VERSION AS builder
WORKDIR /app

RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Prepare node_modules
COPY ./ ./

# Run phase
FROM --platform=linux/amd64 node:$NODE_VERSION AS runner

LABEL org.opencontainers.image.source=https://github.com/xpadev-net/ticket-management

WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl

COPY --from=builder /app ./

# Copy artifacts
