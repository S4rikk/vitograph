#!/bin/bash
cd /opt/vitograph

# Забираем свежий код из гитхаба
git pull origin main

# Сборка фронтенда (Next.js)
echo "Building frontend..."
cd apps/web
npm install
npm run build
cd ../..

# Сборка AI движка (Node.js)
echo "Building AI Engine..."
cd apps/api/src/ai
npm install
npm run build
cd ../../../

# Перезагружаем оба процесса
pm2 restart vitograph vitograph-ai
