@echo off
setlocal EnableExtensions DisableDelayedExpansion
title The Hub launcher

set "HUB_EXE=%~dp0The Hub.exe"
set "HUB_REPORT_DIR=%TEMP%\The Hub\diagnostics"
if not exist "%HUB_REPORT_DIR%" mkdir "%HUB_REPORT_DIR%" >nul 2>&1
set "HUB_REPORT=%HUB_REPORT_DIR%\windows-launch.txt"

> "%HUB_REPORT%" echo The Hub Windows launch report
>> "%HUB_REPORT%" echo Application version: 0.1.2
>> "%HUB_REPORT%" ver
>> "%HUB_REPORT%" echo Processor architecture: %PROCESSOR_ARCHITECTURE%
if defined PROCESSOR_ARCHITEW6432 >> "%HUB_REPORT%" echo Native processor architecture: %PROCESSOR_ARCHITEW6432%
>> "%HUB_REPORT%" echo Launcher started: %DATE% %TIME%

if not exist "%HUB_EXE%" (
  >> "%HUB_REPORT%" echo Launch result: application executable is missing beside the launcher.
  echo Use Extract All on the ZIP first, then run this launcher from the extracted folder.
  start "" notepad.exe "%HUB_REPORT%"
  pause
  exit /b 2
)

echo Opening The Hub. Keep this window open while the application runs.
echo This window stays open after the application exits, including exit code 0.
echo Launch report: "%HUB_REPORT%"
echo Startup log: "%APPDATA%\The Hub\diagnostics\desktop-startup.log"
pushd "%~dp0"
start "" /wait "%HUB_EXE%"
set "HUB_RESULT=%ERRORLEVEL%"
popd
>> "%HUB_REPORT%" echo Application exit code: %HUB_RESULT%
>> "%HUB_REPORT%" echo Application returned: %DATE% %TIME%
if exist "%APPDATA%\The Hub\diagnostics\desktop-startup.log" (
  >> "%HUB_REPORT%" echo.
  >> "%HUB_REPORT%" echo Desktop startup stages:
  >> "%HUB_REPORT%" type "%APPDATA%\The Hub\diagnostics\desktop-startup.log"
)
if exist "%TEMP%\The Hub\diagnostics\desktop-startup.log" (
  >> "%HUB_REPORT%" echo.
  >> "%HUB_REPORT%" echo Temporary desktop startup stages:
  >> "%HUB_REPORT%" type "%TEMP%\The Hub\diagnostics\desktop-startup.log"
)

echo.
type "%HUB_REPORT%"
echo.
echo The report is opening in Notepad. You can copy its text into the chat.
start "" notepad.exe "%HUB_REPORT%"
pause
exit /b %HUB_RESULT%
