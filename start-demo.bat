@echo off
setlocal EnableDelayedExpansion
title infunion demo launcher

REM Remote demo launcher for Windows: starts Postgres, seeds the demo data,
REM runs the backend, and exposes it through ngrok on a fixed public domain
REM so the demo APK can reach it from anywhere.
REM
REM The app itself is the APK installed on the phone - there is no Expo dev
REM server, no QR code and no Expo Go involved. For local development on your
REM own Wi-Fi with Expo Go, use start.bat instead.
REM
REM This domain must match EXPO_PUBLIC_API_URL in app\eas.json's "preview"
REM profile. If you change it, change it in both places and rebuild the APK.
set "NGROK_DOMAIN=bloomers-amusable-dork.ngrok-free.dev"

cd /d "%~dp0"

echo ================================================
echo   infunion - starting the remote demo backend
echo ================================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js / npm not found on PATH.
    echo Install Node.js from https://nodejs.org and re-run this file.
    pause
    exit /b 1
)

where ngrok >nul 2>&1
if errorlevel 1 (
    echo [ERROR] ngrok not found on PATH.
    echo Install it from https://ngrok.com/download, run "ngrok config add-authtoken ^<token^>",
    echo then re-run this file.
    pause
    exit /b 1
)

REM Close windows this script opened last time, so re-running it restarts
REM everything instead of piling up duplicate servers and tunnels.
taskkill /F /FI "WINDOWTITLE eq infunion Demo Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq infunion Demo Tunnel*"  >nul 2>&1

REM --- Database ---
where docker >nul 2>&1
if errorlevel 1 (
    echo [!] Docker not found on PATH - make sure PostgreSQL is running locally
    echo     ^(see backend\.env.example for the expected connection settings^)
) else (
    echo Starting PostgreSQL via Docker...
    docker compose up -d
    echo Waiting a moment for PostgreSQL to accept connections...
    timeout /t 5 /nobreak >nul
)
echo.

REM --- Backend: env, install, seed ---
echo Setting up backend...
pushd backend
if not exist .env copy .env.example .env >nul
call npm install
call npm run seed
if errorlevel 1 (
    echo.
    echo [ERROR] The demo data could not be loaded - see the messages above.
    echo         Copy them to Claude. Press a key to start anyway.
    pause >nul
)
popd
echo.

REM --- Launch the backend and the tunnel, each in its own window ---
echo Launching backend and ngrok tunnel...

pushd backend
start "infunion Demo Backend" cmd /k npm run start:dev
popd

start "infunion Demo Tunnel" cmd /k ngrok http 3000 --url https://%NGROK_DOMAIN%

echo.
echo ================================================
echo   Demo backend is coming up
echo     Public API:  https://%NGROK_DOMAIN%
echo     Local API:   http://localhost:3000
echo.
echo     Open the infunion app on your phone - it already
echo     points at the public URL above.
echo.
echo     Demo admin login: admin@carmen.example / demo1234
echo     ^(Nuestra Senora del Carmen; "Iniciar sesion" in the app
echo      opens the demo member directly, no code^)
echo.
echo   Leave both windows open for the whole demo. Closing
echo   THIS window does not stop them - close their own
echo   windows, or re-run this file for a clean restart.
echo ================================================
pause
exit /b 0
