@echo off
title VITOGRAPH - Development Launcher
echo ===================================================
echo   Starting VITOGRAPH Local Development Environment
echo ===================================================
echo.

set ROOT_DIR=C:\project\VITOGRAPH

echo [1/3] Starting Python Core (Port 8001)...
start "Python Core API (8001)" cmd /k "cd /d %ROOT_DIR%\apps\api && title Python Core API (8001) && uvicorn main:app --reload --port 8001"

echo [2/3] Starting Node.js AI Gateway (Port 3001)...
start "Node AI Gateway (3001)" cmd /k "cd /d %ROOT_DIR%\apps\api\src\ai && title Node AI Gateway (3001) && npm run dev"

echo [3/3] Starting Next.js Frontend (Port 3000)...
start "Next.js Frontend (3000)" cmd /k "cd /d %ROOT_DIR%\apps\web && title Next.js Frontend (3000) && npm run dev"

echo.
echo All services have been launched in separate windows!
echo Web App: http://localhost:3000
echo.
pause
