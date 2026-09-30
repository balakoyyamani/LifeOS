# ==============================================================================
# LifeOS Multi-Stage Production Dockerfile
# Builds unified container: Express 5 API server serving both /api and static UI
# ==============================================================================

# --- Stage 1: Build & Bundle ---
FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.4.2 --activate

# Copy root workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./

# Copy all packages and workspaces
COPY artifacts/ ./artifacts/
COPY lib/ ./lib/
COPY scripts/ ./scripts/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Optional build-time argument for Vite frontend bundling
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Typecheck and build production targets (@workspace/lifeos and @workspace/api-server)
ENV NODE_ENV=production
RUN pnpm run build

# --- Stage 2: Production Minimal Runtime ---
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install curl for healthcheck probe
RUN apk add --no-cache curl

# Copy compiled backend bundle from builder
COPY --from=builder /app/artifacts/api-server/dist ./dist

# Copy compiled frontend SPA bundle
COPY --from=builder /app/artifacts/lifeos/dist/public ./artifacts/lifeos/dist/public

# Copy migration files for deployment-time execution if needed
COPY --from=builder /app/lib/db/drizzle ./lib/db/drizzle

# Create non-root user for security
USER node

EXPOSE 5000

# Container healthcheck using native healthz endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/healthz || exit 1

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
