# Production image for the React client: build with Vite, serve with Nginx.
# Build from the repo root, because the client is an npm workspace that uses @playloop/shared:
#
#   docker build -f client/Dockerfile -t playloop-client .
#
# The container serves the app on port 80 and forwards /api to API_UPSTREAM, so the browser stays
# on one origin and the session cookie works, as with the Vite proxy and the Amplify rewrite.

FROM node:22-alpine AS build
WORKDIR /app

# Every workspace's package.json is needed for npm to resolve the lockfile.
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
RUN npm ci --workspace @playloop/client && npm cache clean --force

COPY shared shared
COPY client client

# Baked into the bundle at build time. Leave it as /api unless the API is on another origin.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build --workspace @playloop/client

FROM nginx:1.28-alpine

# Where /api requests go. The default is the gateway service in docker-compose.yml.
ENV API_UPSTREAM=http://gateway:80
# Lets the config template use the container's own DNS servers (see nginx.conf.template).
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

COPY client/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=5s --timeout=5s --retries=12 CMD wget -qO- http://127.0.0.1/healthz || exit 1
