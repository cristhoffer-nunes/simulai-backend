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

exec "$@"
