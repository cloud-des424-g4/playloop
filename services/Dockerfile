FROM node:22-alpine

ARG SERVICE
ENV SERVICE=$SERVICE
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY shared/package.json shared/
COPY lambdas/build-unzip/package.json lambdas/build-unzip/
COPY lambdas/monthly-badges/package.json lambdas/monthly-badges/
COPY services/kit/package.json services/kit/
COPY services/identity/package.json services/identity/
COPY services/community/package.json services/community/
COPY services/notifications/package.json services/notifications/
COPY services/media/package.json services/media/
COPY services/stack-tests/package.json services/stack-tests/
RUN npm ci --omit=dev --workspace @playloop/$SERVICE && npm cache clean --force

COPY shared shared
COPY services/kit services/kit
COPY services/$SERVICE services/$SERVICE
COPY docs/api docs/api

USER node
HEALTHCHECK --interval=5s --timeout=5s --retries=12 CMD wget -qO- http://127.0.0.1:$PORT/api/health || exit 1
# exec makes Node PID 1, so SIGTERM reaches it
CMD exec node services/$SERVICE/src/server.js
