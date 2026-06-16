FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run prisma:generate
RUN npm run build
RUN echo "Verifying path alias resolution..." && \
    if grep -rqE "require\(['\"]@(lib|config|middleware|routes)/|require\(['\"]@/types" dist/; then \
      echo "ERROR: Unresolved TypeScript path aliases in dist/:"; \
      grep -rnE "require\(['\"]@(lib|config|middleware|routes)/|require\(['\"]@/types" dist/; \
      exit 1; \
    fi && \
    echo "OK: all aliases resolved"

# ---- runtime ----
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD ["node", "dist/index.js"]
