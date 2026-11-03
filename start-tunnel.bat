@echo off
title Cloudflare Tunnel for Elasticsearch (Port 9200)
echo =======================================================================
echo    Starting Cloudflare Tunnel for Elasticsearch (Port 9200)
echo    100%% Free - Powered by Cloudflare Edge Network
echo =======================================================================
echo.
echo Connecting to localhost:9200...
cloudflared tunnel --url http://localhost:9200
pause
