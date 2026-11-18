#!/bin/sh
set -eu

: "${JWT_SECRET:?Set JWT_SECRET on the Railway service}"
if [ "${RAILWAY_VOLUME_MOUNT_PATH:-}" != /data ]; then
    echo "Mount the Railway volume at /data before starting CookBook AI." >&2
    exit 1
fi

export DATABASE_URL=file:/data/cookbook.db
chown node:node /data
chmod 0750 /data

exec gosu node sh -ec '
    npm run db:migrate
    if [ ! -f /data/.catalog-ready ]; then
        npm run db:seed -- -- --catalog-only
        touch /data/.catalog-ready
    fi
    exec node dist/src/main.js
'
