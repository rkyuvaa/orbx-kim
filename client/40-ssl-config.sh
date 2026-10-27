#!/bin/sh
set -e

DOMAIN="${DOMAIN:-one.konwertindiamotors.com}"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

# Remove any stray config files in conf.d to prevent nginx from loading them concurrently
rm -f /etc/nginx/conf.d/nginx-http.conf /etc/nginx/conf.d/nginx-ssl.conf

if [ -f "${CERT_DIR}/fullchain.pem" ] && [ -f "${CERT_DIR}/privkey.pem" ]; then
    echo ">> [SSL] Active SSL certificate found for ${DOMAIN}. Enabling HTTPS."
    cp /etc/nginx/templates/nginx-ssl.conf /etc/nginx/conf.d/default.conf
else
    echo ">> [SSL] No SSL certificate found for ${DOMAIN}. Starting in HTTP mode for ACME challenge."
    cp /etc/nginx/templates/nginx-http.conf /etc/nginx/conf.d/default.conf
fi
