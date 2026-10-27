#!/usr/bin/env bash
set -e

DOMAIN="${1:-one.konwertindiamotors.com}"
EMAIL="${2:-admin@konwertindiamotors.com}"

echo "========================================================"
echo "  Configuring SSL for https://${DOMAIN}                 "
echo "========================================================"

# 1. Ensure docker compose services (web) are up
echo ">> 1. Ensuring containers are running..."
docker compose up -d web

# 2. Request Let's Encrypt certificate using webroot mode
echo ">> 2. Requesting SSL certificate from Let's Encrypt for ${DOMAIN}..."
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    -d "${DOMAIN}"

# 3. Switch Nginx to SSL configuration and reload
echo ">> 3. Activating SSL in Nginx..."
docker compose exec web sh -c "cp /etc/nginx/conf.d/nginx-ssl.conf /etc/nginx/conf.d/default.conf && nginx -s reload"

# 4. Start certbot auto-renewal background container
echo ">> 4. Starting Certbot auto-renewal service..."
docker compose up -d certbot

echo "========================================================"
echo "  Success! Your ERP is now live with HTTPS:             "
echo "  👉 https://${DOMAIN}                                  "
echo "========================================================"
