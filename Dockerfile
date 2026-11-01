# syntax=docker/dockerfile:1

# Pin pnpm so the image matches the pnpm that wrote pnpm-lock.yaml.
# Keep this in sync when upgrading pnpm locally.
ARG PNPM_VERSION=12.16.1

# Build stage
FROM node:22-slim AS builder
ARG PNPM_VERSION

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files. pnpm-workspace.yaml holds the allowBuilds list that lets
# esbuild and better-sqlite3 run their install scripts.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build the app
RUN pnpm build

# Production stage
FROM node:22-slim AS runner
ARG PNPM_VERSION

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Shared, writable corepack cache so the non-root user can resolve pnpm at runtime.
ENV COREPACK_HOME="/opt/corepack"
RUN mkdir -p "$COREPACK_HOME" && corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install all dependencies (needed for migrations and maintenance scripts)
RUN pnpm install --frozen-lockfile

# Copy built app from builder
COPY --from=builder /app/build ./build

# Copy migrations, maintenance scripts and their source imports
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Create data directory for SQLite
RUN mkdir -p /app/data

# Create non-root user with a writable home. Runtime commands run the binaries
# in node_modules/.bin directly (see docker-compose.yml), so the pnpm store
# under /pnpm does not need to be writable here.
RUN groupadd -r nodejs && useradd -r -g nodejs -m nodejs
RUN chown -R nodejs:nodejs /app /opt/corepack
USER nodejs

# Expose port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Start the app
CMD ["node", "build/index.js"]
