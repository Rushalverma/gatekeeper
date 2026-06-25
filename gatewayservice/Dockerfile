# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: deps
#   Install only production dependencies on top of the full alpine image so
#   we can copy just node_modules into the lean final stage.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS deps

WORKDIR /app

# Copy manifests first — Docker caches this layer until package.json changes
COPY package.json package-lock.json* ./

# Install production deps only (no nodemon, no dev tools)
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: runner
#   Copy source + pre-built node_modules. No build tools in final image.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS runner

# Security: run as non-root
RUN addgroup -S gateway && adduser -S gateway -G gateway

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY --chown=gateway:gateway . .

# Switch to non-root user
USER gateway

# Expose the port the Express app listens on
EXPOSE 3000

# Health check — Docker will mark the container unhealthy if this fails.
# Nginx's upstream health checks will then stop routing to it.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Start the production server (never use nodemon in a container)
CMD ["node", "server.js"]
