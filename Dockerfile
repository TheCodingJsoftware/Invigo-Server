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
