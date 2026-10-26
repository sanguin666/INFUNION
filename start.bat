@echo off
setlocal EnableDelayedExpansion
title infunion launcher

REM One-click LOCAL dev launcher for Windows, for working at home with the
REM phone on the same Wi-Fi and the app running in Expo Go. To demo the app
REM away from this network, use start-demo.bat with the built APK instead.
REM
REM Starts Postgres (via Docker if
REM available), installs/updates dependencies, seeds the demo data, and
REM launches the backend, admin dashboard, and mobile app each in their
REM own window. Re-run this file any time to restart everything - it
REM closes any windows it previously opened first, so it's always a clean
REM restart regardless of whether you closed them yourself.

cd /d "%~dp0"

echo ================================================
echo   infunion - starting everything
echo ================================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js / npm not found on PATH.
    echo Install Node.js from https://nodejs.org and re-run this file.
    pause
    exit /b 1
)

REM Close windows this script opened last time, so re-running it restarts
REM everything instead of piling up duplicate dev servers.
taskkill /F /FI "WINDOWTITLE eq infunion Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq infunion Admin*"   >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq infunion App*"     >nul 2>&1

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

REM --- Admin dashboard: env, install ---
echo Setting up admin dashboard...
pushd admin
if not exist .env copy .env.example .env >nul
call npm install
REM Vite's dependency cache now lives in the Windows temp folder instead of
REM node_modules\.vite - inside Dropbox it was getting locked mid-rename and
REM the dashboard came up blank. Clear the old in-project one if it's still
REM lying around; failing to delete it is harmless, nothing reads it now.
if exist node_modules\.vite rd /s /q node_modules\.vite >nul 2>&1
popd
echo.

REM --- Mobile app: env, install ---
echo Setting up mobile app...
pushd app
if not exist .env copy .env.example .env >nul
REM Always refresh the API URL to this PC's current network IP. This file is
REM the local/Expo Go path, so app\.env should always point at the LAN - a
REM leftover tunnel URL from a remote demo would otherwise silently persist.
call :detect_lan_ip
if defined LAN_IP (
    powershell -NoProfile -Command "(Get-Content .env) -replace 'EXPO_PUBLIC_API_URL=.*', 'EXPO_PUBLIC_API_URL=http://!LAN_IP!:3000' | Set-Content .env" >nul
    echo   Set EXPO_PUBLIC_API_URL to http://!LAN_IP!:3000 ^(this PC's network IP^)
    echo   so Expo Go on a phone can reach the backend over Wi-Fi.
) else (
    echo   [!] Could not detect this PC's network IP - check EXPO_PUBLIC_API_URL
    echo       in app\.env by hand before scanning the QR code.
)
call npm install
popd
echo.

REM --- Launch everything, each in its own window ---
echo Launching backend, admin dashboard, and mobile app...

pushd backend
start "infunion Backend" cmd /k npm run start:dev
popd

pushd admin
start "infunion Admin" cmd /k npm run dev
popd

pushd app
start "infunion App" cmd /k npm run start
popd

echo.
echo ================================================
echo   All set!
echo     Backend:          http://localhost:3000
echo     Admin dashboard:  http://localhost:5173
echo     Mobile app:       scan the QR code in its window
echo     App in a browser: http://localhost:8081 ^(also the phone preview on the
echo                       dashboard's Home page, so keep the App window open^)
echo.
echo     Demo admin login: admin@carmen.example / demo1234
echo     ^(Nuestra Senora del Carmen; "Iniciar sesion" in the app
echo      opens the demo member directly, no code^)
echo.
echo   Phone must be on the same Wi-Fi as this PC. Demoing
echo   somewhere else? Use start-demo.bat and the APK instead.
echo.
echo   Closing THIS window does not stop the 3 services -
echo   close their own windows to stop them, or just re-run
echo   this file any time for a full restart.
echo ================================================
pause
exit /b 0

:detect_lan_ip
set "LAN_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i /c:"IPv4 Address"') do (
    if not defined LAN_IP (
        set "ip=%%a"
        set "ip=!ip: =!"
        if not "!ip!"=="127.0.0.1" set "LAN_IP=!ip!"
    )
)
exit /b 0
