FROM node:18-slim

# Install required system dependencies for Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
  wget \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  libgbm1 \
  libxss1 \
  fonts-ipafont-gothic \
  fonts-wqy-zenhei \
  fonts-thai-tlwg \
  fonts-kacst \
  fonts-freefont-ttf \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Install Google Chrome
RUN apt-get update \
  && apt-get install -y gnupg \
  && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update \
  && apt-get install -y google-chrome-stable \
  && rm -rf /var/lib/apt/lists/*

# Set Puppeteer environment variables
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Set working directory
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/

# Copy shared package files
COPY shared/package*.json ./shared/

# Install dependencies
RUN cd backend && npm install --legacy-peer-deps

# Copy app code
COPY backend/ ./backend/
COPY shared/ ./shared/

# Set working directory to backend for build
WORKDIR /app/backend

# Build app
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Use non-root user
RUN groupadd -r nodeuser && useradd -r -g nodeuser -m nodeuser

# Create directories for Chrome user data
RUN mkdir -p /home/nodeuser/.local/share/applications \
  && mkdir -p /home/nodeuser/.config/google-chrome \
  && chown -R nodeuser:nodeuser /home/nodeuser

USER nodeuser

EXPOSE 3000

# Run DB migrations and start the app
CMD ["sh", "-c", "npx drizzle-kit migrate --config=drizzle.config.ts && node dist/index.js"]
