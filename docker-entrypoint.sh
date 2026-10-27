#!/bin/sh
set -e

# In production the RS256 keypair comes from secrets (JWT_PRIVATE_KEY / JWT_PUBLIC_KEY — base64 of
# the full PEM) instead of a bind-mounted ./keys directory. Written into the container's own
# ephemeral filesystem before boot; a no-op in local dev, where ./keys is mounted.
if [ -n "$JWT_PRIVATE_KEY" ]; then
  mkdir -p "$(dirname "$JWT_PRIVATE_KEY_PATH")"
  echo "$JWT_PRIVATE_KEY" | base64 -d > "$JWT_PRIVATE_KEY_PATH"
fi

if [ -n "$JWT_PUBLIC_KEY" ]; then
  mkdir -p "$(dirname "$JWT_PUBLIC_KEY_PATH")"
  echo "$JWT_PUBLIC_KEY" | base64 -d > "$JWT_PUBLIC_KEY_PATH"
fi

# Pending migrations are applied before the API starts (idempotent: nothing to do when up to
# date). The container exits if a migration fails, so a broken schema never serves traffic.
# Set RUN_MIGRATIONS=false to manage migrations by hand.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations..."
  ./node_modules/.bin/prisma migrate deploy
fi

# Roles, permissions, the subject catalog and (when SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are
# set) the first administrator. Idempotent: existing rows are never changed.
if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "Seeding reference data..."
  node dist-seed/prisma/seed.js
fi

exec "$@"
