@echo off
REM ============================================================
REM YUMMY — Start cả Frontend + Backend bằng 1 lệnh (Windows)
REM Usage: start.bat
REM ============================================================

setlocal enabledelayedexpansion

set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%backend
set FRONTEND_DIR=%ROOT_DIR%frontend

REM ── Load .env ──────────────────────────────────────────────
if not exist "%ROOT_DIR%.env" (
    echo ⚠️  Không tìm thấy .env
    echo    Chạy:  copy .env.example .env
    echo    Sau đó điền GEMINI_API_KEY rồi chạy lại start.bat
    pause
    exit /b 1
)

REM Parse .env (đọc các dòng không bắt đầu bằng #)
for /f "usebackq tokens=1,2 delims==" %%A in ("%ROOT_DIR%.env") do (
    set line=%%A
    if not "!line:~0,1!"=="#" (
        if not "%%A"=="" set %%A=%%B
    )
)

if "%BACKEND_PORT%"=="" set BACKEND_PORT=8000
if "%FRONTEND_PORT%"=="" set FRONTEND_PORT=3000

echo.
echo ⚡ YUMMY — AI SDLC Platform
echo ==================================

REM ── Backend ────────────────────────────────────────────────
echo.
echo [Backend] Chuẩn bị Python venv...
cd /d "%BACKEND_DIR%"

if not exist "venv" (
    python -m venv venv
    echo [Backend] Tạo venv xong
)

call venv\Scripts\activate.bat
pip install -r requirements.txt -q
echo [Backend] Dependencies OK

echo [Backend] Khởi động tại http://localhost:%BACKEND_PORT% ...
start "YUMMY Backend" cmd /c "cd /d %BACKEND_DIR% && call venv\Scripts\activate.bat && set GEMINI_API_KEY=%GEMINI_API_KEY% && set AI_PROVIDER=%AI_PROVIDER% && uvicorn main:app --reload --port %BACKEND_PORT%"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM ── Frontend ───────────────────────────────────────────────
echo.
echo [Frontend] Chuẩn bị Node.js...
cd /d "%FRONTEND_DIR%"

REM Write .env.local
echo NEXT_PUBLIC_API_URL=http://localhost:%BACKEND_PORT%> .env.local

if not exist "node_modules" (
    echo [Frontend] Cài npm packages (lần đầu chạy)...
    npm install --silent
)

echo [Frontend] Dependencies OK
echo [Frontend] Khởi động tại http://localhost:%FRONTEND_PORT% ...
start "YUMMY Frontend" cmd /c "cd /d %FRONTEND_DIR% && npm run dev -- --port %FRONTEND_PORT%"

REM ── Done ───────────────────────────────────────────────────
echo.
echo ==================================
echo ✅ YUMMY đang chạy!
echo.
echo   🌐 App:     http://localhost:%FRONTEND_PORT%
echo   🔌 API:     http://localhost:%BACKEND_PORT%
echo   📖 Swagger: http://localhost:%BACKEND_PORT%/docs
echo ==================================
echo.
echo Đóng 2 cửa sổ terminal để dừng.
pause
