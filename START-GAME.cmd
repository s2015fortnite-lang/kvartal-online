@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
  ) else (
    echo Please install Node.js 22 from https://nodejs.org and run this file again.
    pause
    exit /b 1
  )
)
if not exist "node_modules\ws\package.json" goto build
if not exist "server-dist\server\index.js" goto build
if not exist "dist\index.html" goto build
goto run
:build
where npm >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 including npm, then run this file again.
  pause
  exit /b 1
)
call npm ci
if errorlevel 1 goto fail
call npm run build
if errorlevel 1 goto fail
:run
echo.
echo Open http://localhost:3000 in your browser.
echo Keep this window open while playing. Press Ctrl+C to stop.
echo Internet play requires deploying the project. See DEPLOY-RENDER.md.
echo.
node server-dist\server\index.js
if errorlevel 1 goto fail
exit /b 0
:fail
pause
exit /b 1
