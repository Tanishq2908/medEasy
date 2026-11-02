# One image that runs MedEasy anywhere: builds the React app, then serves it
# together with the Flask API from a single gunicorn process.
#
#   docker build -t medeasy .
#   docker run -p 5000:5000 -v medeasy-data:/data medeasy
#   -> http://localhost:5000

# ── Stage 1: build the frontend ─────────────────────────────
FROM node:22-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# ── Stage 2: Python runtime ─────────────────────────────────
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000 \
    DATABASE_PATH=/data/medeasy.db
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
COPY samples ./samples
COPY --from=web /app/dist ./dist
RUN mkdir -p /data && useradd --create-home --uid 10001 medeasy && chown -R medeasy /data /app
USER medeasy
VOLUME ["/data"]
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/health')" || exit 1
CMD ["sh", "-c", "gunicorn backend.app:app --workers 2 --timeout 120 --bind 0.0.0.0:${PORT}"]
