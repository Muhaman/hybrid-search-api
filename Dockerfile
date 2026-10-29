FROM node:24-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json tsconfig.build.json ./
COPY src src
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    MODEL_CACHE_DIR=/app/.model-cache \
    SNAPSHOT_PATH=/app/data/snapshot.json
COPY package.json ./
RUN npm install --omit=dev \
    && mkdir -p /app/.model-cache /app/data \
    && chown node:node /app/.model-cache /app/data
COPY --from=build /app/dist dist
USER node
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "dist/index.js"]
