@echo off
title Cloudflare Tunnel for Elasticsearch (Port 9200)
echo =======================================================================
echo    Starting Cloudflare Tunnel for Elasticsearch (Port 9200)
echo    100%% Free - Powered by Cloudflare Edge Network (HTTP/2)
echo =======================================================================
echo.
echo Connecting to localhost:9200 via HTTP/2...
cloudflared tunnel --protocol http2 --url http://localhost:9200
pause
