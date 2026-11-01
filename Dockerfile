# syntax=docker/dockerfile:1

# Build stage
FROM node:22-slim AS builder

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

# Copy source
COPY . .

# Build the app
RUN pnpm build

# Production stage
FROM node:22-slim AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Shared, writable corepack cache so the non-root user can resolve pnpm at runtime.
ENV COREPACK_HOME="/opt/corepack"
RUN mkdir -p "$COREPACK_HOME" && corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (needed for migrations and scripts)
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

# Copy built app from builder
COPY --from=builder /app/build ./build

# Copy migrations and scripts needed for setup
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Create data directory for SQLite
RUN mkdir -p /app/data

# Create non-root user with a writable home (pnpm/corepack need it at runtime)
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


