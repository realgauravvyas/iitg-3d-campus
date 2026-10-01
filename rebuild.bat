@echo off
rem Rebuild the game from the data.  "rebuild.bat fresh" also re-downloads all map data first.
cd /d "%~dp0"
if /i "%1"=="fresh" (
  python tools\fetch_data.py || goto :err
  python tools\fetch_overture.py || goto :err
  python tools\fetch_landcover.py || goto :err
)
python tools\process_data.py || goto :err
if not exist node_modules call npm install --no-audit --no-fund || goto :err
node tools\build.mjs || goto :err
echo.
echo Done. Double-click launch.bat to play.
pause
exit /b 0
:err
echo Build failed - see the messages above.
pause
exit /b 1
