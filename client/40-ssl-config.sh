#!/bin/sh
set -e

DOMAIN="${DOMAIN:-one.konwertindiamotors.com}"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

if [ -f "${CERT_DIR}/fullchain.pem" ] && [ -f "${CERT_DIR}/privkey.pem" ]; then
    echo ">> [SSL] Active SSL certificate found for ${DOMAIN}. Enabling HTTPS configuration."
    cp /etc/nginx/conf.d/nginx-ssl.conf /etc/nginx/conf.d/default.conf
else
    echo ">> [SSL] No SSL certificate found for ${DOMAIN}. Using HTTP configuration with ACME challenge support."
    cp /etc/nginx/conf.d/nginx-http.conf /etc/nginx/conf.d/default.conf
fi
