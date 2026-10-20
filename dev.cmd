@echo off
if /I "%~1"=="--check" goto check
powershell.exe -NoLogo -NoProfile -NoExit -ExecutionPolicy RemoteSigned -Command ". '%~dp0scripts\dev-shell.ps1'"
exit /b

:check
powershell.exe -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -Command ". '%~dp0scripts\dev-shell.ps1'"
exit /b
