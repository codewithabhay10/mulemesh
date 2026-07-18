#!/usr/bin/env bash
# MuleMesh one-command launcher (macOS / Linux)
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "creating python venv..."
  python3 -m venv .venv
fi
./.venv/bin/pip install -q -r backend/requirements.txt

if [ ! -d frontend/node_modules ]; then
  echo "installing frontend deps..."
  (cd frontend && npm install --no-fund --no-audit)
fi

echo "starting backend on :8000..."
./.venv/bin/python -m uvicorn backend.app.main:app --port 8000 &
BACK_PID=$!
trap "kill $BACK_PID" EXIT

echo "starting frontend on :5173..."
cd frontend && npm run dev -- --open
