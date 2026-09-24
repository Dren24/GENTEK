FROM python:3.11-slim

# Install Node.js 20
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install frontend deps and build React
COPY package*.json ./
RUN npm install

COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY src/ ./src/
COPY public/ ./public/

# Vite bakes VITE_* vars into the JS bundle at build time, not read at
# runtime — Render passes dashboard-configured env vars as Docker build
# args automatically, but only for ARGs declared here. Both are safe to
# expose (public OAuth client ID, a numeric limit) — never put secrets here,
# they'd end up baked into the built JS and the image layer history.
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_FREE_WORD_LIMIT
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_FREE_WORD_LIMIT=$VITE_FREE_WORD_LIMIT

RUN npm run build

# Install Python deps
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source
COPY backend/ ./backend/

EXPOSE 8000
WORKDIR /app/backend
CMD python3 -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
