@echo off
REM ── Befit dev server launcher ──────────────────────────────────────────────
REM Activates the venv and starts uvicorn in reload mode.
REM The frontend is served from /  (index.html) and /app/* (static files).
REM
REM Usage:
REM   1. Copy env.example to .env and fill in OPENAI_API_KEY
REM   2. Double-click this file OR run it from a terminal
REM   3. Open http://localhost:8000 in your browser

cd /d "%~dp0"
call .venv\Scripts\activate.bat

echo.
echo  Befit backend starting on http://localhost:8000
echo  Press Ctrl+C to stop.
echo.

python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
