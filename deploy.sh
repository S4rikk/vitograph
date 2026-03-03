#!/bin/bash
cd /opt/vitograph

# Забираем свежий код из гитхаба
git pull origin main

# !!! Раскомментируйте или измените эти строки, если вам нужно 
# собирать проект после каждого пуша:
# npm install
# npm run build

# Перезагружаем оба процесса
pm2 restart vitograph vitograph-ai
