@echo off
REM ============================================================
REM  DevFlow Manager - one-click release build
REM  Builds the app and drops a versioned portable folder
REM  ("DevFlow-Manager-<version>") next to the release ZIPs.
REM
REM  Usage:
REM     build-release.bat
REM     build-release.bat --out-dir "D:\releases"
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo === Building DevFlow Manager release ===
echo.

call node scripts\make-release.mjs %*
set EXITCODE=%ERRORLEVEL%

echo.
if %EXITCODE% NEQ 0 (
  echo *** BUILD FAILED (exit code %EXITCODE%) ***
) else (
  echo *** BUILD COMPLETE ***
)
echo.
pause
exit /b %EXITCODE%
