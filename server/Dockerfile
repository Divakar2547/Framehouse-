# ─────────────────────────────────────────────────────────────────────────────
# Framehouse — Server Dockerfile
#
# Stages:
#   base        — shared Node + deps layer
#   development — hot-reload via node --watch (used by docker compose)
#   production  — lean production image (used for manual docker builds)
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20

# ─── Stage 1: base ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS base

WORKDIR /app

# Install OS deps required by Sharp (libvips)
RUN apk add --no-cache \
    vips-dev \
    fftw-dev \
    gcc \
    g++ \
    make \
    python3

# Copy dependency manifests first for better layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install all deps (including devDeps — needed for prisma CLI)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# ─── Stage 2: development ─────────────────────────────────────────────────────
FROM base AS development

# Copy source (volumes will override in compose, but needed for standalone run)
COPY src ./src

# Create storage dir for local mock S3 fallback
RUN mkdir -p /app/storage

EXPOSE 5000

# node --watch for hot-reload without nodemon dependency
CMD ["node", "--watch", "src/server.js"]

# ─── Stage 3: production ──────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /app

# Install only the runtime OS deps for Sharp
RUN apk add --no-cache vips

# Copy package files and install production deps only
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

# Copy application source
COPY src ./src

# Storage directory for mock S3 fallback (empty in production if S3 configured)
RUN mkdir -p /app/storage

# Run as non-root user for security
RUN addgroup -S framehouse && adduser -S framehouse -G framehouse
RUN chown -R framehouse:framehouse /app
USER framehouse

EXPOSE 5000

CMD ["node", "src/server.js"]
