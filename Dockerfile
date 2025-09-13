# Use explicit x64 architecture to ensure CycleTLS binary compatibility
FROM node:20-slim

# Install required system dependencies for Puppeteer/Chromium and Xvfb
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
  xvfb \
  x11vnc \
  fluxbox \
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

# Set up virtual display environment
ENV DISPLAY=:99
ENV XVFB_WHD=1920x1080x24

# Set working directory
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/

# Copy shared package files
COPY shared/package*.json ./shared/

# Install dependencies
RUN cd backend && npm install --legacy-peer-deps

# Configure CycleTLS binaries for container environment
RUN echo "=== Configuring CycleTLS binaries ===" && \
    cd backend && \
    find node_modules/cycletls -type f -name "cycletls*" -exec chmod +x {} \; && \
    find node_modules/cycletls -type f -name "*.so" -exec chmod +x {} \; && \
    find node_modules/cycletls -type f -name "*.exe" -exec chmod +x {} \; && \
    echo "✓ CycleTLS binary permissions set"

# Set CycleTLS environment variables for container
ENV CYCLETLS_PATH=/app/backend/node_modules/cycletls
ENV CGO_ENABLED=1

# Copy app code
COPY backend/ ./backend/
COPY shared/ ./shared/
COPY drizzle.config.ts ./
COPY drizzle.config.ts ./backend/

# Enhanced CycleTLS architecture validation and debugging
RUN echo "=== ARCHITECTURE VALIDATION ===" && \
    echo "System architecture: $(uname -m)" && \
    echo "Node version: $(node --version)" && \
    echo "Platform: $(node -p 'process.platform')" && \
    echo "Arch: $(node -p 'process.arch')" && \
    echo "" && \
    if [ "$(node -p 'process.arch')" != "x64" ]; then \
        echo "❌ ERROR: Expected x64 architecture, got $(node -p 'process.arch')" && \
        echo "CycleTLS binaries are built for x64 and will not work on $(node -p 'process.arch')" && \
        exit 1; \
    else \
        echo "✅ Architecture validation passed: $(node -p 'process.arch')"; \
    fi && \
    echo ""

# CycleTLS binary validation and setup
RUN cd /app/backend && \
    echo "=== CYCLETLS BINARY VALIDATION ===" && \
    EXPECTED_BINARY="cycletls-$(node -p 'process.platform')-$(node -p 'process.arch')" && \
    BINARY_PATH="node_modules/cycletls/dist/$EXPECTED_BINARY" && \
    echo "Expected binary: $EXPECTED_BINARY" && \
    if [ -f "$BINARY_PATH" ]; then \
        echo "✅ Found CycleTLS binary: $BINARY_PATH" && \
        chmod +x "$BINARY_PATH" && \
        ls -la "$BINARY_PATH" && \
        file "$BINARY_PATH" 2>/dev/null || echo "file command unavailable" && \
        echo "✅ CycleTLS binary validation completed"; \
    else \
        echo "❌ CycleTLS binary not found: $BINARY_PATH" && \
        echo "Available binaries in cycletls/dist/:" && \
        ls -la node_modules/cycletls/dist/ 2>/dev/null || echo "cycletls/dist directory not found" && \
        exit 1; \
    fi && \
    echo ""

# Test CycleTLS module loading (critical for Azure compatibility)
RUN cd /app/backend && \
    echo "=== CYCLETLS MODULE VALIDATION ===" && \
    timeout 15 node -e "
        try {
            const cycletls = require('cycletls');
            if (typeof cycletls === 'function') {
                console.log('✅ CycleTLS module loaded successfully');
                process.exit(0);
            } else {
                console.log('❌ CycleTLS module invalid - not a function');
                process.exit(1);
            }
        } catch (error) {
            console.log('❌ CycleTLS module loading failed:', error.message);
            process.exit(1);
        }
    " && echo "✅ CycleTLS module validation completed" || \
    (echo "❌ CycleTLS module validation failed" && exit 1) && \
    echo ""

# Database migration files validation
RUN echo "=== DATABASE FILES VALIDATION ===" && \
    ls -la /app/backend/db/migrations/ || echo "migrations dir not found" && \
    ls -la /app/backend/db/migrations/meta/ || echo "meta dir not found" && \
    find /app -name "_journal.json" -type f || echo "No _journal.json found anywhere" && \
    find /app -name "drizzle.config.ts" -type f || echo "No drizzle.config.ts found anywhere"
RUN test -f /app/backend/db/migrations/meta/_journal.json || (echo "ERROR: _journal.json not found at /app/backend/db/migrations/meta/" && exit 1)
RUN test -f /app/backend/drizzle.config.ts || (echo "ERROR: drizzle.config.ts not found at /app/backend/" && exit 1)
RUN echo "✓ Migration files verified successfully - Build 2025-08-13-20:15"

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

# Run DB migrations and start the app with conditional virtual display and comprehensive CycleTLS diagnostics
CMD ["sh", "-c", "cd /app/backend && if [ \"$NODE_ENV\" = \"staging\" ] || [ \"$NODE_ENV\" = \"production\" ]; then echo '=== Starting Xvfb virtual display for Azure ===' && Xvfb :99 -screen 0 1920x1080x24 & sleep 2; else echo '=== Skipping Xvfb for development environment ==='; fi && echo '=== RUNTIME DEBUG: Comprehensive startup diagnostics ===' && echo 'System Info:' && echo 'Architecture: $(uname -m)' && echo 'Node Platform: $(node -p \"process.platform\")' && echo 'Node Arch: $(node -p \"process.arch\")' && echo 'NODE_ENV: $NODE_ENV' && echo 'IS_AZURE: $IS_AZURE' && echo '' && echo 'Migration files:' && ls -la /app/backend/db/migrations/ && ls -la /app/backend/db/migrations/meta/ && find /app -name '_journal.json' -type f && echo '' && echo 'CycleTLS Runtime Check:' && find /app/backend/node_modules/cycletls -name 'cycletls*' -type f -exec sh -c 'echo \"Binary: $1\"; ls -la \"$1\"; file \"$1\" 2>/dev/null || echo \"file command unavailable\"' _ {} \\; && echo 'CycleTLS Test:' && node -e 'try { const cycletls = require(\"cycletls\"); console.log(\"✓ CycleTLS module loads successfully\"); } catch(e) { console.log(\"✗ CycleTLS module failed:\", e.message); }' && echo '=== END RUNTIME DEBUG ===' && npx drizzle-kit migrate --config=../drizzle.config.ts && node dist/index.js"]

