@echo off
REM YUMMY - Start both Frontend + Backend with a single command
REM Usage: start.bat

setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
REM Backend now uses TypeScript / Hono (backend-ts/). Legacy Python
REM backend (backend/) is kept as a fallback but no longer started.
set "BACKEND_DIR=%ROOT_DIR%backend-ts"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

REM Auto-create .env from .env.example if missing
if not exist "%ROOT_DIR%.env" (
    if exist "%ROOT_DIR%.env.example" (
        copy "%ROOT_DIR%.env.example" "%ROOT_DIR%.env" >nul
        echo Created .env from .env.example
        echo Please open .env and fill in your API keys, then run start.bat again.
        pause
        exit /b 0
    ) else (
        echo ERROR: Neither .env nor .env.example found.
        pause
        exit /b 1
    )
)

REM Parse .env - skip comment lines
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ROOT_DIR%.env") do (
    set "_k=%%A"
    set "_v=%%B"
    if not "!_k!"=="" (
        set "!_k!=!_v!"
    )
)

if "!BACKEND_PORT!"=="" set "BACKEND_PORT=8000"
if "!FRONTEND_PORT!"=="" set "FRONTEND_PORT=3000"
if "!AI_PROVIDER!"=="" set "AI_PROVIDER=gemini"

echo.
echo YUMMY - AI SDLC Platform
echo ==================================
echo.
echo Select AI Provider:
echo.
echo   [1] Gemini       (Google - requires GEMINI_API_KEY)
echo   [2] OpenAI       (requires OPENAI_API_KEY)
echo   [3] Bedrock      (AWS - requires AWS credentials)
echo   [4] Copilot      (GitHub Copilot - requires COPILOT_GITHUB_TOKEN)
echo   [5] Ollama       (Local - no API key needed)
echo   [6] Keep current (!AI_PROVIDER!)
echo.
set /p "PROVIDER_CHOICE=Enter number and press Enter [default: 6]: "

if "!PROVIDER_CHOICE!"=="1" (
    set "AI_PROVIDER=gemini"
    call :configure_gemini
) else if "!PROVIDER_CHOICE!"=="2" (
    set "AI_PROVIDER=openai"
    call :configure_openai
) else if "!PROVIDER_CHOICE!"=="3" (
    set "AI_PROVIDER=bedrock"
    call :configure_bedrock
) else if "!PROVIDER_CHOICE!"=="4" (
    set "AI_PROVIDER=copilot"
    call :configure_copilot
) else if "!PROVIDER_CHOICE!"=="5" (
    set "AI_PROVIDER=ollama"
    call :configure_ollama
) else (
    echo Using current provider: !AI_PROVIDER!
)

REM Validate required keys for chosen provider
call :validate_provider
if errorlevel 1 (
    pause
    exit /b 1
)

REM Save provider choice back to .env
call :update_env "AI_PROVIDER" "!AI_PROVIDER!"

echo.
echo Provider set to: !AI_PROVIDER!
echo ==================================

REM Backend (TypeScript / Hono)
echo.
echo [Backend] Setting up Node.js / pnpm...
cd /d "%BACKEND_DIR%"

where node >nul 2>&1
if errorlevel 1 (
    echo [Backend] ERROR: Node.js not found. Install Node 20+ from https://nodejs.org
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
    echo [Backend] pnpm not found. Installing via npm...
    call npm install -g pnpm
    if errorlevel 1 (
        echo [Backend] ERROR: Failed to install pnpm.
        pause
        exit /b 1
    )
)

if not exist "node_modules" (
    echo [Backend] Installing dependencies ^(first run^)...
    call pnpm install --silent
    if errorlevel 1 (
        echo [Backend] ERROR: pnpm install failed.
        pause
        exit /b 1
    )
)
echo [Backend] Dependencies OK

REM Apply DB migrations (idempotent)
call pnpm db:migrate >nul 2>&1

echo [Backend] Starting at http://localhost:!BACKEND_PORT! ...
start "YUMMY Backend" cmd /c "cd /d "!BACKEND_DIR!" && set PORT=!BACKEND_PORT! && set AI_PROVIDER=!AI_PROVIDER! && set GEMINI_API_KEY=!GEMINI_API_KEY! && set GEMINI_MODEL=!GEMINI_MODEL! && set OPENAI_API_KEY=!OPENAI_API_KEY! && set OPENAI_MODEL=!OPENAI_MODEL! && set AWS_ACCESS_KEY_ID=!AWS_ACCESS_KEY_ID! && set AWS_SECRET_ACCESS_KEY=!AWS_SECRET_ACCESS_KEY! && set AWS_REGION=!AWS_REGION! && set BEDROCK_MODEL=!BEDROCK_MODEL! && set COPILOT_GITHUB_TOKEN=!COPILOT_GITHUB_TOKEN! && set COPILOT_MODEL=!COPILOT_MODEL! && set OLLAMA_BASE_URL=!OLLAMA_BASE_URL! && set OLLAMA_MODEL=!OLLAMA_MODEL! && pnpm dev"

timeout /t 3 /nobreak >nul

REM Frontend
echo.
echo [Frontend] Setting up Node.js...
cd /d "%FRONTEND_DIR%"

(echo NEXT_PUBLIC_API_URL=http://localhost:!BACKEND_PORT!) > "%FRONTEND_DIR%\.env.local"

if not exist "node_modules" (
    echo [Frontend] Installing npm packages ^(first run^)...
    npm install --silent
)

echo [Frontend] Dependencies OK
echo [Frontend] Starting at http://localhost:!FRONTEND_PORT! ...
start "YUMMY Frontend" cmd /c "cd /d "!FRONTEND_DIR!" && npm run dev -- --port !FRONTEND_PORT!"

REM Done
echo.
echo ==================================
echo YUMMY is running!  [Provider: !AI_PROVIDER!]
echo.
echo   App:     http://localhost:!FRONTEND_PORT!
echo   API:     http://localhost:!BACKEND_PORT!
echo   Swagger: http://localhost:!BACKEND_PORT!/docs
echo ==================================
echo.
echo Close the 2 terminal windows to stop.
pause
exit /b 0

REM ============================================================
REM  PROVIDER CONFIGURATION SUBROUTINES
REM ============================================================

:configure_gemini
echo.
echo -- Gemini Configuration --
if "!GEMINI_API_KEY!"=="" (
    set /p "GEMINI_API_KEY=Enter GEMINI_API_KEY (or press Enter to skip): "
    if not "!GEMINI_API_KEY!"=="" call :update_env "GEMINI_API_KEY" "!GEMINI_API_KEY!"
)
set /p "GEMINI_MODEL_INPUT=Gemini model [!GEMINI_MODEL!]: "
if not "!GEMINI_MODEL_INPUT!"=="" (
    set "GEMINI_MODEL=!GEMINI_MODEL_INPUT!"
    call :update_env "GEMINI_MODEL" "!GEMINI_MODEL!"
)
exit /b 0

:configure_openai
echo.
echo -- OpenAI Configuration --
if "!OPENAI_API_KEY!"=="" (
    set /p "OPENAI_API_KEY=Enter OPENAI_API_KEY (or press Enter to skip): "
    if not "!OPENAI_API_KEY!"=="" call :update_env "OPENAI_API_KEY" "!OPENAI_API_KEY!"
)
set /p "OPENAI_MODEL_INPUT=OpenAI model [!OPENAI_MODEL!]: "
if not "!OPENAI_MODEL_INPUT!"=="" (
    set "OPENAI_MODEL=!OPENAI_MODEL_INPUT!"
    call :update_env "OPENAI_MODEL" "!OPENAI_MODEL!"
)
exit /b 0

:configure_bedrock
echo.
echo -- AWS Bedrock Configuration --
if "!AWS_ACCESS_KEY_ID!"=="" (
    set /p "AWS_ACCESS_KEY_ID=Enter AWS_ACCESS_KEY_ID (or press Enter to skip): "
    if not "!AWS_ACCESS_KEY_ID!"=="" call :update_env "AWS_ACCESS_KEY_ID" "!AWS_ACCESS_KEY_ID!"
)
if "!AWS_SECRET_ACCESS_KEY!"=="" (
    set /p "AWS_SECRET_ACCESS_KEY=Enter AWS_SECRET_ACCESS_KEY (or press Enter to skip): "
    if not "!AWS_SECRET_ACCESS_KEY!"=="" call :update_env "AWS_SECRET_ACCESS_KEY" "!AWS_SECRET_ACCESS_KEY!"
)
set /p "AWS_REGION_INPUT=AWS region [!AWS_REGION!]: "
if not "!AWS_REGION_INPUT!"=="" (
    set "AWS_REGION=!AWS_REGION_INPUT!"
    call :update_env "AWS_REGION" "!AWS_REGION!"
)
set /p "BEDROCK_MODEL_INPUT=Bedrock model [!BEDROCK_MODEL!]: "
if not "!BEDROCK_MODEL_INPUT!"=="" (
    set "BEDROCK_MODEL=!BEDROCK_MODEL_INPUT!"
    call :update_env "BEDROCK_MODEL" "!BEDROCK_MODEL!"
)
exit /b 0

:configure_copilot
echo.
echo -- GitHub Copilot Configuration --
if "!COPILOT_GITHUB_TOKEN!"=="" (
    set /p "COPILOT_GITHUB_TOKEN=Enter COPILOT_GITHUB_TOKEN (or press Enter to skip): "
    if not "!COPILOT_GITHUB_TOKEN!"=="" call :update_env "COPILOT_GITHUB_TOKEN" "!COPILOT_GITHUB_TOKEN!"
)
set /p "COPILOT_MODEL_INPUT=Copilot model [!COPILOT_MODEL!]: "
if not "!COPILOT_MODEL_INPUT!"=="" (
    set "COPILOT_MODEL=!COPILOT_MODEL_INPUT!"
    call :update_env "COPILOT_MODEL" "!COPILOT_MODEL!"
)
exit /b 0

:configure_ollama
echo.
echo -- Ollama Configuration --
if "!OLLAMA_BASE_URL!"=="" set "OLLAMA_BASE_URL=http://localhost:11434"
set /p "OLLAMA_BASE_URL_INPUT=Ollama URL [!OLLAMA_BASE_URL!]: "
if not "!OLLAMA_BASE_URL_INPUT!"=="" (
    set "OLLAMA_BASE_URL=!OLLAMA_BASE_URL_INPUT!"
    call :update_env "OLLAMA_BASE_URL" "!OLLAMA_BASE_URL!"
)
if "!OLLAMA_MODEL!"=="" set "OLLAMA_MODEL=llama3"
set /p "OLLAMA_MODEL_INPUT=Ollama model [!OLLAMA_MODEL!]: "
if not "!OLLAMA_MODEL_INPUT!"=="" (
    set "OLLAMA_MODEL=!OLLAMA_MODEL_INPUT!"
    call :update_env "OLLAMA_MODEL" "!OLLAMA_MODEL!"
)
exit /b 0

:validate_provider
if "!AI_PROVIDER!"=="gemini" (
    if "!GEMINI_API_KEY!"=="" (
        echo ERROR: GEMINI_API_KEY is not set. Edit .env or re-run and enter it when prompted.
        exit /b 1
    )
)
if "!AI_PROVIDER!"=="openai" (
    if "!OPENAI_API_KEY!"=="" (
        echo ERROR: OPENAI_API_KEY is not set. Edit .env or re-run and enter it when prompted.
        exit /b 1
    )
)
if "!AI_PROVIDER!"=="bedrock" (
    if "!AWS_ACCESS_KEY_ID!"=="" (
        echo ERROR: AWS_ACCESS_KEY_ID is not set. Edit .env or re-run and enter it when prompted.
        exit /b 1
    )
)
if "!AI_PROVIDER!"=="copilot" (
    if "!COPILOT_GITHUB_TOKEN!"=="" (
        echo ERROR: COPILOT_GITHUB_TOKEN is not set. Edit .env or re-run and enter it when prompted.
        exit /b 1
    )
)
exit /b 0

REM Update or append a key=value in .env
:update_env
set "_key=%~1"
set "_val=%~2"
set "_envfile=%ROOT_DIR%.env"
set "_tmpfile=%ROOT_DIR%.env.tmp"
set "_found=0"
if exist "!_tmpfile!" del "!_tmpfile!"
for /f "usebackq eol=# delims=" %%L in ("!_envfile!") do (
    set "_line=%%L"
    echo !_line! | findstr /b "!_key!=" >nul 2>&1
    if !errorlevel!==0 (
        echo !_key!=!_val!>>"!_tmpfile!"
        set "_found=1"
    ) else (
        echo !_line!>>"!_tmpfile!"
    )
)
if "!_found!"=="0" echo !_key!=!_val!>>"!_tmpfile!"
move /y "!_tmpfile!" "!_envfile!" >nul
exit /b 0
