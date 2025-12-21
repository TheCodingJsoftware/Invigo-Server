# =========================
# Stage 1: Frontend build
# =========================
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build


# =========================
# Stage 2: Backend runtime
# =========================
FROM python:3.12.5-slim

# Runtime system deps only
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        fonts-liberation \
        libglib2.0-0 \
        libnss3 \
        libx11-6 \
        libxrender1 \
        libxext6 \
        libxss1 \
        libasound2 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcairo2 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxi6 \
        libxrandr2 \
        libxtst6 \
        libcups2 \
        xdg-utils && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONPATH=/app
ENV PORT=5057
ENV DATA_PATH=/app/data

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# ✅ Correct frontend artifacts
COPY --from=frontend-builder /frontend/public /app/public

RUN mkdir -p logs data backups

VOLUME ["/app/data"]
EXPOSE 5057

CMD ["python", "main.py"]
