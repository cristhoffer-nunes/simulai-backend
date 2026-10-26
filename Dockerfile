# --- deps + build ---
FROM node:24-slim AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# --- runtime ---
# Debian (glibc), not Alpine: same reasons as lawsuits-management-backend (Docker DNS + Prisma
# OpenSSL 3 engine target).
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts && npx prisma generate

ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node

COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/keys && chown -R node:node /app

# Never run as root.
USER node
EXPOSE 3002
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
