# MuleMesh ships as a single process: FastAPI serves the API *and* the built
# React UI (see main.py, which mounts ../frontend/dist at "/"). So we build the
# UI with Node in stage 1 and copy just the dist into the Python image.

# ---- stage 1: build the React UI ----
FROM node:20-alpine AS ui
WORKDIR /ui
# copy manifests first so npm ci is cached unless deps actually change
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- stage 2: python runtime ----
FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
# main.py resolves dist as parents[2]/"frontend"/"dist" -> /app/frontend/dist
COPY --from=ui /ui/dist frontend/dist

# Render injects PORT; 8000 is the local default.
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# `python -m uvicorn`, NOT bare `uvicorn`: backend/ has no __init__.py and relies
# on being a namespace package found via the working directory. The -m form puts
# cwd on sys.path; the bare console script does not, and fails with
# "ModuleNotFoundError: No module named 'backend'".
CMD ["sh", "-c", "python -m uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
