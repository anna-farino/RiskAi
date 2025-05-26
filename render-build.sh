#!/usr/bin/env bash
set -o errexit

npm install

# Set cache directories
export PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
export XDG_CACHE_HOME=/opt/render/.cache

# Only copy if source and destination are different
if [[ ! -d "$PUPPETEER_CACHE_DIR/chrome" ]]; then 
  echo "...Copying Puppeteer Cache from Build Cache"
  cp -R "$XDG_CACHE_HOME/puppeteer/chrome" "$PUPPETEER_CACHE_DIR/"
elif [[ "$PUPPETEER_CACHE_DIR" != "$XDG_CACHE_HOME/puppeteer" ]]; then
  echo "...Storing Puppeteer Cache in Build Cache"
  cp -R "$PUPPETEER_CACHE_DIR/chrome" "$XDG_CACHE_HOME/puppeteer/"
else
  echo "...Skipping copy: source and destination are the same"
fi

# PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer npx puppeteer browsers install chrome
# mkdir -p .cache/puppeteer
# cp -R /opt/render/.cache/puppeteer/chrome .cache/puppeteer/
#
npx puppeteer browsers install chrome
npx drizzle-kit migrate --config=drizzle.config.ts
npm run build -w backend

