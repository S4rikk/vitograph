@echo off
setlocal

:: Если комментарий к коммиту не передан, используем стандартный
set "COMMIT_MSG=%~1"
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=hotfix: manual update via AI"

echo 🚀 Starting local Git Push (Hotfix)...
git add .
git commit -m "%COMMIT_MSG%"
git push origin main

:: На Windows batch бывает проблема с push в не-main ветку.
git push

echo.
echo ⚡ Connecting to server 69.12.79.201 for FAST hotfix deploy (NO BUILD)...
ssh -o StrictHostKeyChecking=no root@69.12.79.201 "cd /opt/vitograph && git pull origin main && pm2 restart vitograph vitograph-ai"

echo.
echo ✅ Hotfix deployed in seconds!
endlocal
