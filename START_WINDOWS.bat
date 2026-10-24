@echo off
cd /d "%~dp0"
title DAWG Pocket Arcade
where py >nul 2>&1
if not errorlevel 1 (
  py -3 --version >nul 2>&1
  if not errorlevel 1 (
    py -3 start.py %*
    goto done
  )
)
where python >nul 2>&1
if not errorlevel 1 (
  python --version >nul 2>&1
  if not errorlevel 1 (
    python start.py %*
    goto done
  )
)
where node >nul 2>&1
if not errorlevel 1 (
  node start.mjs %*
  goto done
)
echo Install Python 3.9+ or Node.js 18+, then double-click this file again.
echo No API keys or additional packages are needed.
:done
pause
