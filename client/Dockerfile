# ---- Build stage ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

# ---- Serve stage ----
FROM nginx:alpine

# Copy nginx configurations
COPY nginx-http.conf /etc/nginx/conf.d/nginx-http.conf
COPY nginx-ssl.conf /etc/nginx/conf.d/nginx-ssl.conf
COPY nginx-http.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script to auto-detect certificates on container boot
COPY 40-ssl-config.sh /docker-entrypoint.d/40-ssl-config.sh
RUN chmod +x /docker-entrypoint.d/40-ssl-config.sh

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
