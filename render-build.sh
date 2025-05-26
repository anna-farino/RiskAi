#!/usr/bin/env bash
set -o errexit

npm install
PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer npx puppeteer browsers install chrome
mkdir -p .cache/puppeteer
cp -R /opt/render/.cache/puppeteer/chrome .cache/puppeteer/
npx drizzle-kit migrate --config=drizzle.config.ts
npm run build -w backend

