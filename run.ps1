# MuleMesh one-command launcher (Windows)
# Starts the FastAPI backend in a new window, then the Vite dev server here.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path .venv)) {
    Write-Host "creating python venv..." -ForegroundColor Cyan
    python -m venv .venv
}
& .\.venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt

if (-not (Test-Path frontend\node_modules)) {
    Write-Host "installing frontend deps..." -ForegroundColor Cyan
    Push-Location frontend
    npm install --no-fund --no-audit
    Pop-Location
}

Write-Host "starting backend on :8000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "cd '$PSScriptRoot'; .\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --port 8000"

Write-Host "starting frontend on :5173..." -ForegroundColor Cyan
Set-Location frontend
npm run dev -- --open
