@echo off
echo ===================================================
echo VITOGRAPH Universal Test Runner
echo ===================================================

set RESTART=N
set /p RESTART="Доступен свежий код. Желаете ли вы ПЕРЕЗАПУСТИТЬ все сервера (Next.js, Node.js AI, Python) перед прогоном тестов? (Y/N): "
if /I "%RESTART%"=="Y" (
    echo [INFO] Убиваем зависшие процессы на портах 3000, 3001, 8001...
    for %%P in (3000 3001 8001) do (
        for /f "tokens=5" %%a in ('netstat -ano ^| find "LISTENING" ^| find ":%%P"') do (
            if not "%%a"=="0" taskkill /F /PID %%a >nul 2>&1
        )
    )
    echo [INFO] Перезапускаем сервера...
    call start_vitograph_dev.bat < nul
    echo [INFO] Ожидаем 10 секунд для инициализации...
    timeout /t 10
)

echo [1/2] Running Backend Integration Tests (Vitest)
cd apps\api\src\ai
call npx vitest run
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Vitest failed!
  exit /b %ERRORLEVEL%
)
cd ..\..\..\..

echo Checking local dev servers (Ports 3000 and 3001)...
netstat -ano | find "LISTENING" | find ":3000" >nul
if %ERRORLEVEL% NEQ 0 goto server_error

netstat -ano | find "LISTENING" | find ":3001" >nul
if %ERRORLEVEL% NEQ 0 goto server_error

goto servers_ok

:server_error
echo =================================
echo [ERROR] Servers are down!
echo Please start your local dev environment (e.g. NextJS and Node Proxy) before running E2E tests.
echo =================================
exit /b 1

:servers_ok
echo Servers are up. Proceeding to E2E...

echo [2/2] Running Frontend E2E Tests (Playwright - Headless)
cd apps\web
call npx playwright test --project=chromium
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Playwright tests failed!
  exit /b %ERRORLEVEL%
)
cd ..\..

echo ===================================================
echo [SUCCESS] ALL TESTS PASSED!
echo ===================================================
