#!/usr/bin/env bash
set -e

DOMAIN="${1:-one.konwertindiamotors.com}"
EMAIL="${2:-admin@konwertindiamotors.com}"

echo "========================================================"
echo "  Configuring SSL for https://${DOMAIN}                 "
echo "========================================================"

# 1. Rebuild web container with updated templates and start it
echo ">> 1. Rebuilding and starting web container..."
docker compose up -d --build web

echo ">> 2. Waiting for web container to be ready on port 80..."
sleep 3

# Verify container is running
if ! docker compose ps web | grep -q "Up"; then
    echo ">> Error: Web container failed to start. Logs:"
    docker compose logs --tail=20 web
    exit 1
fi

# 2. Request Let's Encrypt certificate using webroot mode
echo ">> 3. Requesting SSL certificate from Let's Encrypt for ${DOMAIN}..."
docker compose run --rm --entrypoint certbot certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    -d "${DOMAIN}"

# 3. Switch Nginx to SSL configuration and restart
echo ">> 4. Activating SSL in Nginx..."
docker compose restart web

# 4. Start certbot auto-renewal background container
echo ">> 5. Starting Certbot auto-renewal service..."
docker compose up -d certbot

echo "========================================================"
echo "  Success! Your ERP is now live with HTTPS:             "
echo "  👉 https://${DOMAIN}                                  "
echo "========================================================"
