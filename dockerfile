FROM python:3.12.5-slim

# Install system dependencies, including Node.js.
RUN apt-get update && \
    apt-get install -y \
        curl \
        wget \
        gnupg \
        ca-certificates \
        fonts-liberation \
        libappindicator3-1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgcc1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        xdg-utils && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

ENV PYTHONPATH="/app"
ENV PORT=5057
ENV DATA_PATH="/app/data"
ENV POSTGRES_USER="admin"
ENV POSTGRES_PASSWORD=""
ENV POSTGRES_DB="invigo-test"
ENV POSTGRES_HOST="172.17.0.1"
ENV POSTGRES_PORT=5434
ENV POSTGRES_MIN_CONNECTIONS=5
ENV POSTGRES_MAX_CONNECTIONS=20
ENV POSTGRES_TIMEOUT=60
ENV POSTGRES_COMMAND_TIMEOUT=60
ENV POSTGRES_MAX_INACTIVE_CONNECTION_LIFETIME=60
ENV WORKSPACE_BACKGROUND_CACHE_WARM_UP_INTERVAL=60

# Copy only the dependency files to leverage Docker caching
COPY requirements.txt package.json package-lock.json* ./

# Install Python dependencies
RUN pip install --upgrade pip && pip install -r requirements.txt

# Install Node.js dependencies
RUN npm install

# Now copy the rest of your application source code (including webpack config, etc.)
COPY . .

# Now run the Node.js build process (make sure your package.json has a "build" script)
RUN npm run build

# Create required directories (if not already created by your build or setup)
RUN mkdir -p logs data backups

# Define volumes for persistent storage
VOLUME ["/app/data"]

# Expose port 5057 (or whichever port your app uses)
EXPOSE 5057

# Set the default command to run your server
CMD ["python", "main.py"]
