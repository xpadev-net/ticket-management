ARG NODE_VERSION=20-slim

# Build phase
FROM node:$NODE_VERSION AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Prepare node_modules
COPY ./ ./

# Run phase
FROM node:$NODE_VERSION AS runner

LABEL org.opencontainers.image.source=https://github.com/xpadev-net/video_host_frontend
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl
COPY --from=builder /app ./

RUN npx prisma generate

# Copy artifacts
CMD ["./start.sh"]