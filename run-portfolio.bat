@echo off
title Peketi Yaswanth - Portfolio Starter
echo =======================================================================
echo          PEKETI YASWANTH - PORTFOLIO STARTER
echo =======================================================================
echo.
echo [1/2] Starting Backend Server...
start "Portfolio Backend" cmd /k "node backend/server.js"

echo [2/2] Opening Portfolio in Browser...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo =======================================================================
echo   SUCCESS!
echo.
echo   * Local Portfolio:   http://localhost:3000
echo   * Live Cloud Render: https://my-portfolio-zani.onrender.com
echo =======================================================================
echo.
