#!/usr/bin/env bash
set -o errexit

npm install

# Set Puppeteer cache path
export PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
mkdir -p $PUPPETEER_CACHE_DIR

# Store/pull Puppeteer cache with build cache
if [[ ! -d $PUPPETEER_CACHE_DIR/chrome ]]; then 
  echo "...Copying Puppeteer Cache from Build Cache" 
  cp -R $XDG_CACHE_HOME/puppeteer/chrome $PUPPETEER_CACHE_DIR/
else 
  echo "...Storing Puppeteer Cache in Build Cache" 
  cp -R $PUPPETEER_CACHE_DIR/chrome $XDG_CACHE_HOME/puppeteer/
fi

# PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer npx puppeteer browsers install chrome
# mkdir -p .cache/puppeteer
# cp -R /opt/render/.cache/puppeteer/chrome .cache/puppeteer/
#

npx drizzle-kit migrate --config=drizzle.config.ts
npm run build -w backend

