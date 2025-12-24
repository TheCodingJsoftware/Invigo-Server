FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to install deps
USER root

WORKDIR /srv

# Copy npm manifests
COPY package.json package-lock.json* ./

# Install runtime deps
RUN npm install --omit=dev

# Copy server code
COPY server.js /srv/server.js

# Fix ownership so non-root can run
RUN chown -R pptruser:pptruser /srv

# Drop back to non-root user (important)
USER pptruser

EXPOSE 3000

CMD ["node", "/srv/server.js"]
