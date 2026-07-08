@echo off
REM ============================================================
REM  DevFlow Manager - one-click release build
REM  Builds the app and drops a versioned portable folder
REM  ("DevFlow-Manager-<version>") next to the release ZIPs.
REM
REM  When run by double-click, you'll be asked:
REM    [N] type a custom version   (e.g. 0.2.0, or just "12" for the patch)
REM    [R] auto +1 patch bump      (default)
REM    [S] same version            (rebuilds/overwrites the current release)
REM
REM  Usage:
REM     build-release.bat
REM     build-release.bat --same              (skip the prompt, rebuild in place)
REM     build-release.bat --auto              (skip the prompt, auto +1)
REM     build-release.bat --version 0.2.0     (skip the prompt, set exact version)
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
