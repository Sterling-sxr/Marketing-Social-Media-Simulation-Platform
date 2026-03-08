# frontend/Dockerfile
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app

# Install build deps to satisfy native module compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy only manifest files to leverage layer caching
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# (Optional) Switch registry in flaky networks; remove once stable
# RUN npm config set registry https://registry.npmmirror.com

# Keep only `set -eux` plus install logic
RUN set -eux; \
  if [ -f yarn.lock ]; then \
    corepack enable || npm i -g corepack; corepack enable; \
    yarn install --frozen-lockfile --non-interactive; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable || npm i -g corepack; corepack enable; \
    pnpm install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then \
    npm ci --no-audit --no-fund --foreground-scripts --loglevel=info; \
  else \
    npm install --no-audit --no-fund --foreground-scripts --loglevel=info; \
  fi


# Copy the source and build
COPY . .
RUN npm run build

FROM nginx:alpine
# Vite outputs compiled assets to /app/dist
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
