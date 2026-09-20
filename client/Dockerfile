# ─────────────────────────────────────────────────────────────────────────────
# Framehouse — Client Dockerfile
#
# Stages:
#   development — Vite dev server with HMR (used by docker compose)
#   builder     — production build
#   production  — nginx serving the static Vite build
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20

# ─── Stage 1: development ─────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Source is mounted as a volume in compose for hot-reload
# Copy here as fallback for standalone run
COPY . .

EXPOSE 5173

# --host 0.0.0.0 makes Vite accessible outside the container
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_SERVER_URL must be passed at build time as a build arg
ARG VITE_SERVER_URL=https://framehouse-r7yy.onrender.com
ENV VITE_SERVER_URL=${VITE_SERVER_URL}

RUN npm run build

# ─── Stage 3: production (nginx) ──────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Copy Vite build output
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config to handle React Router (SPA fallback)
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
