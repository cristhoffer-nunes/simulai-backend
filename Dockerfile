# --- deps + build ---
FROM node:24-slim AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build
# The seed (roles, permissions, catalog, first admin) runs in production without ts-node.
RUN npx tsc -p tsconfig.seed.json

# --- runtime ---
# Debian (glibc), not Alpine: same reasons as lawsuits-management-backend (Docker DNS + Prisma
# OpenSSL 3 engine target).
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Set by the release workflow (package.json version + commit); empty locally, where the health
# check falls back to package.json.
ARG APP_VERSION=
ARG GIT_SHA=
ENV APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.title="simulai-backend" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.source="https://github.com/cristhoffer-nunes/simulai-backend"

RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
# Install scripts run on purpose: @prisma/engines downloads the query and schema engines here, at
# build time, so `prisma migrate deploy` works at startup without reaching the internet.
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-seed ./dist-seed
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/keys && chown -R node:node /app

# Never run as root.
USER node
EXPOSE 3002
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
