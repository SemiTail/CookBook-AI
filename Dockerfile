FROM node:26-bookworm-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/package.json backend/package-lock.json backend/
COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm --prefix backend ci --no-audit --no-fund \
    && npm --prefix frontend ci --no-audit --no-fund

COPY backend/ backend/
COPY frontend/ frontend/
RUN DATABASE_URL=file:/tmp/cookbook-build.db npm --prefix backend run build \
    && npm --prefix frontend run build

FROM node:26-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates gosu openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY --from=build /app/backend/package.json /app/backend/tsconfig.json /app/backend/prisma7.config.ts ./
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/generated ./generated
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/frontend/dist /app/frontend/dist
COPY scripts/start-railway.sh /app/start-railway.sh

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    HOME=/home/node \
    FRONTEND_DIST=/app/frontend/dist

CMD ["sh", "/app/start-railway.sh"]
