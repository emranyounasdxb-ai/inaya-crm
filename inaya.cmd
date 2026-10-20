@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0scripts\run-project.ps1" %*
exit /b %errorlevel%
