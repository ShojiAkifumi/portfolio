@echo off
rem Double-click to open the works capture app (tools/capture-gui.ps1)
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0tools\capture-gui.ps1"
