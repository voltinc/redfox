# syntax=docker/dockerfile:1

# --- web bundle -------------------------------------------------------------
FROM node:20-bookworm-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# --- runtime ----------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    REDFOX_DATA_DIR=/data \
    REDFOX_BUILD_DIR=/builds

# better-sqlite3 compiles against the bundled Node headers, so a toolchain is needed
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates dnsutils \
 && apt-get clean \
 && find /var/lib/apt/lists -mindepth 1 -delete

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/ ./server/
COPY scripts/ ./scripts/
COPY docs/ ./docs/
COPY README.md ./
COPY --from=web /app/web/dist ./web/dist

RUN mkdir -p /data /builds && chown -R node:node /data /builds /app
USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
