#!/usr/bin/env bash
set -e

echo "=========================================="
echo " Starting KIM-One Production Deployment   "
echo "=========================================="

echo ">> 1. Pulling latest code from origin/main..."
git fetch origin main
git reset --hard origin/main

echo ">> 2. Rebuilding and starting containers..."
docker compose up -d --build --remove-orphans

echo ">> 3. Waiting for API container health..."
docker compose ps

echo "=========================================="
echo " Deployment Complete! KIM-One is live.   "
echo "=========================================="
