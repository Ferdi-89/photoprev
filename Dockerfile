# ===================================================
# 📸 PhotoPrev (RTFTP) - Production Dockerfile
# Optimized for high-performance image processing (Sharp)
# ===================================================

FROM node:20-bookworm-slim

# Install curl for container healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests first for optimal Docker layer caching
COPY package*.json ./

# Install production dependencies (sharp installs prebuilt linux-x64 binaries)
RUN npm ci --omit=dev

# Copy application source files
COPY . .

# Create storage and cache directories
RUN mkdir -p /app/storage/demo_session /app/storage/cache

# Environment configuration
ENV NODE_ENV=production
ENV PORT=3000

# Expose HTTP & WebSocket port
EXPOSE 3000

# Mountable volume for photos and cache persistence
VOLUME ["/app/storage"]

# Healthcheck probe for container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server.js"]
