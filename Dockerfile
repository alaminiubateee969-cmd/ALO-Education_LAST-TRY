# syntax=docker/dockerfile:1
# ALO Learning Journey — production image (Next.js standalone output).
# Media is self-contained: FFmpeg/ffprobe ship from @ffmpeg-installer npm
# packages; speech falls back to the built-in formant synthesizer when eSpeak
# is absent. No paid AI APIs are used by the application.

# ── deps: install with the exact lockfile ────────────────────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── build: Prisma client + Next.js standalone output ────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the Prisma client (needs binaries.prisma.sh at build time).
RUN npx prisma generate
# Build standalone output; the build script also copies static assets into
# .next/standalone (see package.json "build").
RUN npm run build

# ── runtime: minimal, non-root ──────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3017 \
    HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates curl \
      espeak-ng \
      fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system alo \
    && useradd --system --gid alo --create-home alo

# Standalone bundle (server.js + traced node_modules), static assets, public/.
COPY --from=build --chown=alo:alo /app/.next/standalone ./
COPY --from=build --chown=alo:alo /app/.next/static ./.next/static
COPY --from=build --chown=alo:alo /app/public ./public
# Full node_modules are also needed for the bundled ffmpeg binaries and
# the native sharp module resolved outside the standalone trace.
COPY --from=build --chown=alo:alo /app/node_modules/@ffmpeg-installer ./node_modules/@ffmpeg-installer
COPY --from=build --chown=alo:alo /app/node_modules/@ffprobe-installer ./node_modules/@ffprobe-installer
COPY --from=build --chown=alo:alo /app/node_modules/sharp ./node_modules/sharp
COPY --from=build --chown=alo:alo /app/node_modules/@img ./node_modules/@img

# Persist generated media and encrypted backups across container updates.
RUN mkdir -p storage/uploads storage/videos storage/scene-assets storage/audio storage/backups \
    && chown -R alo:alo storage
VOLUME ["/app/storage"]

USER alo
EXPOSE 3017
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "server.js"]
