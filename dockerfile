FROM python:3.12.5-slim

# Install system dependencies, including Node.js.
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

ENV PYTHONPATH="/app"
ENV PORT=5057
ENV DATA_PATH="/web/Invigo-server"

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
RUN mkdir -p saved_quotes saved_jobs previous_quotes logs data backups

# Define volumes for persistent storage
VOLUME ["/app/saved_quotes", "/app/saved_jobs", "/app/previous_quotes", "/app/logs", "/app/data", "/app/backups"]

# Expose port 5057 (or whichever port your app uses)
EXPOSE 5057

# Set the default command to run your server
CMD ["python", "server.py"]
