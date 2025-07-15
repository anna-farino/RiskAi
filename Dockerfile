# Use Node.js 18 slim image for smaller size
FROM node:18-slim

# Install system dependencies required for Puppeteer and Chrome
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies first (including dev dependencies for migration)
RUN npm ci

# Copy application code
COPY . .

# Install drizzle-kit for migrations (needed at runtime)
RUN npm install drizzle-kit --save

# Remove other dev dependencies but keep drizzle-kit
RUN npm prune --production

# Create startup script that runs migrations at runtime, then starts the app
RUN echo '#!/bin/sh\nnpx drizzle-kit migrate --config=drizzle.config.ts\nnode index.js' > /app/start.sh && chmod +x /app/start.sh

# Create a non-root user for security
RUN groupadd -r nodeuser && useradd -r -g nodeuser nodeuser
RUN chown -R nodeuser:nodeuser /app
USER nodeuser

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["/app/start.sh"]
