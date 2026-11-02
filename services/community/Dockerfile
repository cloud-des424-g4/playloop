FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
COPY lambdas/build-unzip/package.json lambdas/build-unzip/
COPY lambdas/monthly-badges/package.json lambdas/monthly-badges/
RUN npm ci --omit=dev --workspace @playloop/server && npm cache clean --force

COPY shared shared
COPY server/src server/src
COPY docs/api docs/api

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8080/api/health || exit 1
CMD ["node", "server/src/server.js"]
