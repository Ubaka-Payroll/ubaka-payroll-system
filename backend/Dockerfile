# Build stage
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json .npmrc ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production stage
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json .npmrc ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY database ./database

RUN mkdir -p logs && chown -R node:node /app

USER node

EXPOSE 5000

COPY --chown=node:node docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/server.js"]
