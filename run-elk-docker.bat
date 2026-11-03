@echo off
title Peketi Yaswanth - Full Docker ELK & Portfolio
echo =======================================================================
echo          STARTING FULL DOCKER STACK (POSTGRES + ELK + KIBANA)
echo =======================================================================
echo.
echo Starting all Docker services in background...
docker-compose up -d

echo.
echo Opening Kibana Dashboard and Portfolio...
timeout /t 5 /nobreak >nul
start http://localhost
start http://localhost:5601

echo.
echo =======================================================================
echo   * Portfolio Website:  http://localhost
echo   * Kibana Dashboard:   http://localhost:5601
echo   * Elasticsearch API:  http://localhost:9200
echo =======================================================================
echo.
pause
