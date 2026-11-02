# syntax=docker/dockerfile:1

# ---- Build stage: compile the app into static files ----
FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies first so this layer is cached between code changes
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite (the app) and Astro (the marketing pages) bake VITE_* variables in at
# build time, so the API URL must be passed with --build-arg, not at
# `docker run`. The build fails without it.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

ENV ASTRO_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runtime stage: serve the static files with nginx (runs as non-root) ----
FROM nginxinc/nginx-unprivileged:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
# Not in conf.d/: nginx loads everything there on its own.
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
